"use strict";
import * as Pubnub from "pubnub";
import { Disposable, Event, EventEmitter } from "vscode";
import { Logger } from "../logger";
import { Iterables } from "../system";
import { CodeStreamApi } from "./api";
import { Cache } from "./cache";
import { CSMarker, CSPost, CSRepository, CSStream, CSTeam, CSUser } from "./types";

export enum MessageType {
	Posts = "posts",
	Repositories = "repos",
	Streams = "streams",
	Users = "users",
	Teams = "teams",
	Markers = "markers"
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

export interface UsersMessageReceivedEvent {
	type: MessageType.Users;
	users: CSUser[];
}

export interface TeamsMessageReceivedEvent {
	type: MessageType.Teams;
	teams: CSTeam[];
}

export interface MarkersMessageReceivedEvent {
	type: MessageType.Markers;
	markers: CSMarker[];
}

export type MessageReceivedEvent =
	| PostsMessageReceivedEvent
	| RepositoriesMessageReceivedEvent
	| StreamsMessageReceivedEvent
	| UsersMessageReceivedEvent
	| MarkersMessageReceivedEvent
	| TeamsMessageReceivedEvent;

export class PubNubReceiver {
	private _onDidReceiveMessage = new EventEmitter<MessageReceivedEvent>();
	get onDidReceiveMessage(): Event<MessageReceivedEvent> {
		return this._onDidReceiveMessage.event;
	}

	private _pubnub: Pubnub | undefined;
	private _listener: Pubnub.ListenerParameters | undefined;
	private _userId: string | undefined;
	private _cache: Cache;

	constructor(cache: Cache) {
		this._cache = cache;
	}

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
		const channels = [`user-${userId}`, `team-${teamId}`];

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

	private unsubscribeCore(channels: string[]) {
		if (channels.length === 0) return;

		this._pubnub!.unsubscribe({
			channels: channels
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
		} catch (ex) {
			Logger.error(ex);
		}
	}

	onPresence(event: Pubnub.PresenceEvent) {
		try {
			Logger.log(`PubNub.onPresence: event=${JSON.stringify(event)}`);
		} catch (ex) {
			Logger.error(ex);
		}
		// logger.debug(`user ${event.uuid} ${event.action}. occupancy is ${event.occupancy}`); // uuid of the user
	}

	onStatus(status: Pubnub.StatusEvent) {
		try {
			if ((status as any).error) {
				Logger.warn(`PubNub.onStatus: ERROR event=${JSON.stringify(status)}`);

				const errorStatus = (status as any) as PubNubErrorStatus;
				if (errorStatus.category === Pubnub.CATEGORIES.PNAccessDeniedCategory) {
					const response = JSON.parse(
						errorStatus.errorData.response.text
					) as PubNubAccessDeniedErrorResponse;
					this.unsubscribeCore(response.payload.channels || []);
				}
			} else {
				Logger.log(`PubNub.onStatus: event=${JSON.stringify(status)}`);
			}
		} catch (ex) {
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

	async processMessage(data: { [key: string]: any }) {
		const { requestId, ...messages } = data;
		requestId;

		for (let [key, obj] of Object.entries(messages)) {
			Logger.log(`PubNub '${key}' message received\n${JSON.stringify(obj)}`);

			let entities;
			try {
				switch (key) {
					case "post":
					case "repo":
					case "user":
					case "team":
					case "marker":
					case "stream":
						key += "s";
						entities = [obj];
						break;
					// case "markerLocations"
					default:
						entities = obj;
						break;
				}

				switch (key as MessageType) {
					case "posts":
						const posts = (await this._cache.resolvePosts(entities)) as CSPost[];
						this._onDidReceiveMessage.fire({
							type: MessageType.Posts,
							posts
						});
						break;
					case "repos":
						const repos = (await this._cache.resolveRepos(entities)) as CSRepository[];

						this._onDidReceiveMessage.fire({
							type: MessageType.Repositories,
							repos
						});
						break;
					case "streams":
						const streams = (await this._cache.resolveStreams(entities)) as CSStream[];

						// Subscribe to any new non-file, non-team streams
						this.subscribeCore([
							...Iterables.filterMap(
								streams,
								s =>
									CodeStreamApi.isStreamSubscriptionRequired(s, this._userId!)
										? `stream-${s.id}`
										: undefined
							)
						]);

						this._onDidReceiveMessage.fire({ type: MessageType.Streams, streams: streams });
						break;
					case "users": {
						const users = (await this._cache.resolveUsers(entities)) as CSUser[];
						this._onDidReceiveMessage.fire({ type: MessageType.Users, users });
						break;
					}
					case "teams": {
						const teams = (await this._cache.resolveTeams(entities)) as CSTeam[];
						this._onDidReceiveMessage.fire({ type: MessageType.Teams, teams });
						break;
					}
					case "markers": {
						const markers = (await this._cache.resolveMarkers(entities)) as CSMarker[];
						this._onDidReceiveMessage.fire({ type: MessageType.Markers, markers });
						break;
					}
				}
			} catch (ex) {
				Logger.error(ex, `PubNub '${key}' FAILED`);
			}
		}
	}
}

interface PubNubErrorStatus {
	error: boolean;
	category: string; // Pubnub.Categories;
	operation: Pubnub.Operations;
	statusCode: number;
	errorData: {
		status: number;
		response: {
			text: string;
		};
	};
}

interface PubNubAccessDeniedErrorResponse {
	message: string;
	payload: {
		channels: string[];
		error: boolean;
		service: string;
		status: number;
	};
}
