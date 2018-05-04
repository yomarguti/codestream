'use strict';
import { Disposable, Event, EventEmitter } from 'vscode';
import { CSPost, CSRepository, CSStream } from './types';
import { CodeStreamApi } from './api';
import { Logger } from '../logger';
import Pubnub = require('pubnub');
import { Iterables } from '../system';

export enum MessageType {
    Posts = 'posts',
    Repositories = 'repos',
    Streams = 'streams'
}

export interface PostsMessageReceivedEvent {
    type: MessageType.Posts;
    posts: CSPost[];
}

export interface RepositoriesMessageReceivedEvent {
    type: MessageType.Repositories;
    repos: CSRepository[];
}

export interface StreamsMessageReceivedEvent {
    type: MessageType.Streams;
    streams: CSStream[];
}

export type MessageReceivedEvent = PostsMessageReceivedEvent | RepositoriesMessageReceivedEvent | StreamsMessageReceivedEvent;

export class PubNubReceiver {

    private _onDidReceiveMessage = new EventEmitter<MessageReceivedEvent>();
    get onDidReceiveMessage(): Event<MessageReceivedEvent> {
        return this._onDidReceiveMessage.event;
    }

    private _pubnub: Pubnub | undefined;
    private _listener: Pubnub.ListenerParameters | undefined;
    private _userId: string | undefined;

    initialize(authKey: string, userId: string, subscribeKey: string): Disposable {
        this._userId = userId;

        const uuid = `${userId}`;
        this._pubnub = new Pubnub({
            authKey: authKey,
            uuid: uuid,
            subscribeKey: subscribeKey,
            restore: true,
            logVerbosity: false,
            heartbeatInterval: 30
        });

        this.addListener();

        return {
            dispose: () => {
                this.removeListener();
                this._pubnub && this._pubnub.unsubscribeAll();
            }
        };
    }

    subscribe(userId: string, teamId: string, repoIds: string[], streamIds: string[]) {
        const channels = [
            `user-${userId}`,
            `team-${teamId}`
        ];

        for (const repoId of repoIds) {
            channels.push(`repo-${repoId}`);
        }

        for (const streamId of streamIds) {
            channels.push(`stream-${streamId}`);
        }

        this.subscribeCore(channels);
    }

    private subscribeCore(channels: string[]) {
        if (channels.length === 0) return;

        this._pubnub!.subscribe({
            channels: channels,
            withPresence: false
            // timetoken: number
        });
    }

    private addListener() {
        this._listener = {
            presence: this.onPresence.bind(this),
            message: this.onMessage.bind(this),
            status: this.onStatus.bind(this)
        } as Pubnub.ListenerParameters;
        this._pubnub!.addListener(this._listener);
    }

    private removeListener() {
        if (this._pubnub !== undefined && this._listener !== undefined) {
            this._pubnub.removeListener(this._listener);
        }
    }

    onMessage(event: Pubnub.MessageEvent) {
        try {
            this.processMessage(event.message);
        }
        catch (ex) {
            Logger.error(ex);
        }
    }

    onPresence(event: Pubnub.PresenceEvent) {
        try {
            Logger.log(`PubNub.onPresence: event=${JSON.stringify(event)}`);
        }
        catch (ex) {
            Logger.error(ex);
        }
        // logger.debug(`user ${event.uuid} ${event.action}. occupancy is ${event.occupancy}`); // uuid of the user
    }

    onStatus(status: Pubnub.StatusEvent) {
        try {
            if ((status as any).error) {
                Logger.warn(`PubNub.onStatus: ERROR event=${JSON.stringify(status)}`);
            }
            else {
                Logger.log(`PubNub.onStatus: event=${JSON.stringify(status)}`);
            }
        }
        catch (ex) {
            Logger.error(ex);
        }

        // if (status.error) {
        //     // this sucks ... pubnub does not send us the channel that failed,
        //     // meaning that if we try to subscribe to two channels around the same
        //     // time, we can't know which one this is a status error for ...
        //     // so we'll spit out the error here, but we'll have to rely on the
        //     // subscription timeout to actually handle the failure
        //     const now = new Date().toString();
        //     console.warn(now + ": PUBNUB STATUS ERROR: ", status);
        //     Raven.captureBreadcrumb({
        //         message: `Pubnub status error: ${JSON.stringify(status)}`,
        //         category: "pubnub",
        //         level: "warning"
        //     });
        // }

        // const channels = status.affectedChannels || Object.keys(this.subscriptions);
        // channels;
        // for (const channel of channels) {
        //     if (this.subscriptions[channel]) {
        //         this.subscriptions[channel].status(status);
        //     }
        // }
    }

    processMessage(data: { [key: string]: any }) {
        const { requestId, ...messages } = data;
        requestId;

        for (let [key, obj] of Object.entries(messages)) {
            Logger.log(`PubNub '${key}' message received\n${JSON.stringify(obj)}`);

            if (Object.keys(obj).some(k => k.startsWith('$'))) {
                Logger.log(`PubNub '${key}' message with directive received\n${JSON.stringify(obj)}`);
                continue;
            }

            try {
                switch (key) {
                    case 'post':
                    case 'repo':
                    case 'stream':
                        key += 's';
                        obj = [obj];
                }

                switch (key as MessageType) {
                    case 'posts':
                        if (!obj || !obj.length) continue;

                        this._onDidReceiveMessage.fire({ type: MessageType.Posts, posts: CodeStreamApi.normalizeResponse(obj) as CSPost[] });
                        break;
                    case 'repos':
                        if (!obj || !obj.length) continue;

                        this._onDidReceiveMessage.fire({ type: MessageType.Repositories, repos: CodeStreamApi.normalizeResponse(obj) as CSRepository[] });
                        break;
                    case 'streams':
                        if (!obj || !obj.length) continue;

                        const streams = CodeStreamApi.normalizeResponse(obj) as CSStream[];
                        // Subscribe to any new non-file, non-team streams
                        this.subscribeCore([...Iterables.filterMap(streams, s => CodeStreamApi.isStreamSubscriptionRequired(s, this._userId!) ? `stream-${s.id}` : undefined)]);

                        this._onDidReceiveMessage.fire({ type: MessageType.Streams, streams: streams });
                        break;
                }
            }
            catch (ex) {
                Logger.error(ex, `PubNub '${key}' FAILED`);
            }
        }

        // Raven.captureBreadcrumb({
        //     message: "pubnub event",
        //     category: "pubnub",
        //     data: { requestId, isHistory, ...Object.keys(objects) },
        //     level: "debug"
        // });

        // for (const [key, obj] of Object.entries(objects)) {
        //     const handler = this.getMessageHandler(key);
        //     if (handler) handler(obj, isHistory);
        // }
        // Object.keys(objects).forEach(key => {
        //     const handler = this.getMessageHandler(key);
        //     if (handler) handler(objects[key], isHistory);
        // });
    }

    // subscribe(channels) {
    //     if (this.pubnub === null) throw new Error("PubNubReceiver must be initialized with an authKey and userId before subscribing to channels");

    //     channels.forEach(channel => {
    //         logger.debug("subscribing to", channel);
    //         if (!this.subscriptions[channel]) {
    //             this.subscriptions[channel] = new PubnubSubscription({
    //                 pubnub: this.pubnub,
    //                 channel: channel,
    //                 store: this.store
    //             });
    //         }
    //         this.subscriptions[channel].subscribe();
    //     });
    // }

    // unsubscribeAll() {
    //     for (let channel in this.subscriptions) {
    //         this.subscriptions[channel].unsubscribe();
    //         delete this.subscriptions[channel];
    //     }
    //     this.removeListener();
    // }

    // private getMessageHandler(type: any) {
        // let tableName: string;
        // switch (type) {
        //     case 'stream':
        //     case 'streams':
        //         tableName = 'streams';
        //         break;
        //     case 'post':
        //         return (data, isHistory) => this.store.dispatch(resolvePost(normalize(data), isHistory));
        //     case 'posts':
        //         tableName = 'posts';
        //         break;
        //     case 'user':
        //     case 'users':
        //         tableName = 'users';
        //         break;
        //     case 'team':
        //     case 'teams':
        //         tableName = 'teams';
        //         break;
        //     case 'repo':
        //     case 'repos':
        //         tableName = 'repos';
        //         break;
        //     case 'marker':
        //     case 'markers':
        //         tableName = 'markers';
        //         break;
        //     case 'markerLocations':
        //         return (data, isHistory) =>
        //             this.store.dispatch(saveMarkerLocations(normalize(data), isHistory));
        // }
        // if (tableName)
        //     return (data, isHistory) =>
        //         this.store.dispatch(resolveFromPubnub(tableName, normalize(data), isHistory));
    // }

    // getSubscribedChannels() {
    //     return Object.keys(this.subscriptions).filter(channel =>
    //         this.subscriptions[channel].isSubscribed()
    //     );
    // }

    // retrieveHistory(channels, messaging = {}) {
    //     let retrieveSince;
    //     channels = channels || this.getSubscribedChannels();
    //     if (messaging.lastMessageReceived) {
    //         retrieveSince = messaging.lastMessageReceived;
    //         // FIXME: there probably needs to be a time limit here, where we assume it isn't
    //         // worth replaying all the messages ... instead we just wipe the DB and refresh
    //         // the session ... maybe a week?
    //         return this.retrieveHistorySince(channels, retrieveSince);
    //     } else {
    //         // assuming there's nothing cached yet and this is a clean slate
    //         return this.store
    //             .dispatch(fetchStreamsAndAllPosts())
    //             .then(() => this.store.dispatch(caughtUp()));
    //     }
    // }

    // async retrieveHistorySince(channels, timeToken) {
    //     // fetch the history for each subscribed channel individually...
    //     let allMessages = [];
    //     await Promise.all(
    //         channels.map(channel => {
    //             return this.retrieveChannelHistorySince(channel, timeToken, allMessages);
    //         })
    //     );

    //     // now get numeric timestamps (from the stringified time tokens) and sort based on
    //     // timestamp ... to ensure we process messages in order
    //     allMessages.forEach(message => {
    //         message.timestamp = parseInt(message.timetoken, 10) / 10000;
    //     });
    //     allMessages.sort((a, b) => {
    //         return a.timestamp - b.timestamp;
    //     });

    //     if (allMessages.length > 0) {
    //         // store the last message received, so we know where to start from next time
    //         const lastMessage = allMessages[allMessages.length - 1];
    //         this.store.dispatch(lastMessageReceived(lastMessage.timetoken));
    //     } else {
    //         this.store.dispatch(caughtUp());
    //     }

    //     for (var message of allMessages) {
    //         this.processMessage(message.entry, { isHistory: true });
    //     }
    //     return allMessages.length;
    // }

    // async retrieveChannelHistorySince(channel, timeToken, allMessages) {
    //     let response = null;
    //     let retries = 0;
    //     let delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    //     let delayTime = 1000;
    //     while (!response) {
    //         try {
    //             Raven.captureBreadcrumb({
    //                 message: 'retrieve history',
    //                 category: 'pubnub',
    //                 data: { timeToken },
    //                 level: 'debug'
    //             });
    //             response = await this.pubnub.history({
    //                 channel: channel,
    //                 reverse: true, // oldest message first
    //                 start: timeToken,
    //                 stringifiedTimeToken: true
    //             });
    //         } catch (error) {
    //             const now = new Date().toString();
    //             console.warn(`${now}: PubNub history failed for ${channel}:`, error);
    //             Raven.captureBreadcrumb({
    //                 message: `retrieve history failed`,
    //                 category: 'pubnub',
    //                 data: { error },
    //                 level: 'debug'
    //             });
    //             if (!navigator.onLine) {
    //                 // here we give up prematurely, we'll wait until the signal that we are
    //                 // online again to try
    //                 console.warn(`${now}: HISTORY RETRIEVAL FAILED BUT WE ARE OFFLINE`);
    //                 pollTillOnline();
    //                 return true;
    //             }
    //             if (retries === 30) {
    //                 // increase throttle time, till we reach one minute, then give up
    //                 delayTime = 5000;
    //             } else if (retries === 36) {
    //                 console.warn(`${now}: Giving up fetching history for ${channel}`);
    //                 Raven.captureBreadcrumb({
    //                     message: `gave up fetching history`,
    //                     category: 'pubnub',
    //                     level: 'warning'
    //                 });
    //                 Raven.captureMessage(`history retrieval failure`);
    //                 this.store.dispatch(historyRetrievalFailure());
    //                 return true;
    //             }
    //             retries++;
    //             await delay(delayTime);
    //         }
    //     }

    //     // history was successfully retrieved for all channels
    //     allMessages.push(...response.messages);
    //     if (response.messages.length < 100) {
    //         return true; // resolves the promise
    //     } else {
    //         // FIXME: we can't let this go on too deep, there needs to be a limit
    //         // once we reach that limit, we probably need to just clear the database and
    //         // refresh the session (like you're coming back from vacation)
    //         return this.retrieveChannelHistorySince(channel, response.endTimeToken, allMessages);
    //     }
    // }
}
