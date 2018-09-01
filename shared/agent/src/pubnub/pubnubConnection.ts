// Provide the PubnubConnection class, which encapsulates communications with Pubnub to receive
// messages in real-time
"use strict";
import * as Pubnub from "pubnub";
import { Disposable, Emitter, Event } from "vscode-languageserver";
import { ServerError } from "../agentError";
import { CodeStreamApi } from "../api/api";
import { PubnubHistory, PubnubHistoryInput, PubnubHistoryOutput } from "./pubnubHistory";

// use this interface to initialize the PubnubConnection class
export interface PubnubInitializer {
	api: CodeStreamApi; // api server object, for making direct requests to api server
	accessToken: string; // access token for api requests
	subscribeKey: string; // identifies our Pubnub account, comes from pubnubKey returned with the login response from the API
	authKey: string; // unique Pubnub token provided in the login response
	userId: string; // ID of the current user
	channels?: (ChannelDescriptor | string)[]; // channels to subscribe to, provided on initialization or later using subscribe()
	lastMessageReceivedAt?: number; // should persist across sessions, interruptions in service will retrieve messages since this time
	online?: boolean; // for now, whether the network is online is tracked from without the PubnubConnection instance, but this is still TBD
	testMode?: boolean; // whether we emit test-mode statuses, not normally used in production
	debug?(msg: string, info?: any): void; // for debug messages
}

// when providing channels to subscribe to, you can provide just the channel name,
// or if you want presence notifications, you can use this interface, specifying
// withPresence as true
export interface ChannelDescriptor {
	name: string;
	withPresence?: boolean;
}

// the PubnubConnection instance will emit a status through onStatusChange(), for some
// statuses, information on which channels are affected is also provided
export interface StatusChangeEvent {
	status: PubnubStatus;
	channels?: string[];
}

// one of the statuses emitted in StatusChangeEvent above
export enum PubnubStatus {
	Connected = "Connected", // indicates all channels have been successfully subscribed to as requested
	Trouble = "Trouble", // indicates trouble with the network or one or more subscriptions, should be a temporary state
	Failed = "Failed", // indicates some channels could not be subscribed to, and client action is required to correct this
	Offline = "Offline", // indicates the network is currently offline, so messages won't be received
	Reset = "Reset", // indicates that during catching up on history, there are too many messages or it's been too long...
	// the client should retrieve fresh data from the server as if it is a fresh login
	Aborted = "Aborted", // an aborted state, usually the result of a bad Pubnub token, client must reinitialize

	// the statuses below are used only for testing, normally these are private and black-boxed
	Confirmed = "Confirmed", // indicates subscriptions have been confirmed
	NetworkProblem = "NetworkProblem", // indicates a network problem of some sort
	Queued = "Queued", // indicates channels have been queued for subscribing
	Granted = "Granted" // access was granted to channels
}

// internal, maintains map of channels and whether they are yet successfully subscribed
interface SubscriptionMap {
	[key: string]: {
		subscribed: boolean;
		withPresence?: boolean;
	};
}

// PubNub's retention time is one month ... to avoid missing messages on the edge, we'll
// not try to catch up if we are within ten minutes of that
const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;
const THRESHOLD_FOR_CATCHUP = ONE_MONTH - TEN_MINUTES;
const THRESHOLD_BUFFER = 12000;

export class PubnubConnection {
	private _api: CodeStreamApi | undefined;
	private _subscriptionsPending: boolean = false;
	private _lastSuccessfulSubscription: number = 0;
	private _subscriptions: SubscriptionMap = {};
	private _userId: string | undefined;
	private _subscribeKey: string | undefined;
	private _authKey: string | undefined;
	private _pubnub: Pubnub | undefined;
	private _accessToken: string | undefined;
	private _lastMessageReceivedAt: number = 0;
	private _listener: Pubnub.ListenerParameters | undefined;
	private _messageEmitter = new Emitter<{ [key: string]: any }[]>();
	private _statusEmitter = new Emitter<StatusChangeEvent>();
	private _queuedChannels: ChannelDescriptor[] = [];
	private _statusTimeout: NodeJS.Timer | undefined;
	private _online: boolean = false;
	private _grantFailures: string[] = [];
	private _lastTick: number = 0;
	private _tickInterval: NodeJS.Timer | undefined;
	private _needConnectedMessage: boolean = false;
	private _testMode: boolean = false;
	private _simulateConfirmFailure: boolean = false;
	private _simulateGrantFailure: boolean | string | string[] | undefined;
	private _simulateSubscriptionTimeout: boolean = false;
	private _simulateOffline: boolean = false;
	private _aborted: boolean = false;
	private _numResubscribes: number = 0;
	private _debug: (msg: string, info?: any) => void = () => {};
	private _catchingUpSince: number = 0;
	private _activeFailures: string[] = [];
	private _messagesReceived: { [key: string]: number } = {};

	// call to receive status updates
	get onDidStatusChange(): Event<StatusChangeEvent> {
		return this._statusEmitter.event;
	}

	// call to listen for Pubnub messages
	get onDidReceiveMessages(): Event<{ [key: string]: any }[]> {
		return this._messageEmitter.event;
	}

	// initialize PubnubConnection and optionally subscribe to channels
	initialize(options: PubnubInitializer): Disposable {
		this._debug(`Pubnub Connection initializing...`);
		if (options.debug) {
			this._debug = options.debug;
		}

		this._api = options.api;
		this._subscribeKey = options.subscribeKey;
		this._authKey = options.authKey;
		this._accessToken = options.accessToken;
		this._userId = options.userId;
		this._lastMessageReceivedAt = options.lastMessageReceivedAt || 0;
		this._online = options.online || false;
		this._testMode = options.testMode || false;
		this._aborted = false;
		this._numResubscribes = 0;

		const channels = options.channels || [];
		const channelDescriptors = this.normalizeChannelDescriptors(channels);
		const numAdded = this.addChannels(channelDescriptors);
		if (numAdded > 0) {
			// this says we need to notify the client when we get fully connected
			this._needConnectedMessage = true;
			this._subscriptionsPending = true;
		}

		this._pubnub = new Pubnub({
			authKey: this._authKey,
			uuid: this._userId,
			subscribeKey: this._subscribeKey,
			restore: true,
			logVerbosity: false,
			heartbeatInterval: 30,
			autoNetworkDetection: true
		} as Pubnub.PubnubConfig);

		this.addListener();
		this.startTicking();

		this.subscribeAll();

		return {
			dispose: () => {
				this.unsubscribeAll();
				this._pubnub!.stop();
			}
		};
	}

	// subscribe to the passed channels
	subscribe(channels: (ChannelDescriptor | string)[]) {
		this._debug("Request to subscribe to channels", channels);
		if (this._aborted) {
			this._debug("Pubnub Connection is aborted");
			return this.emitStatus(PubnubStatus.Aborted);
		}
		const channelDescriptors: ChannelDescriptor[] = this.normalizeChannelDescriptors(channels);
		// while processing subscriptions, we hold off accepting new subscriptions until processing is complete,
		// in the meantime, queue them up ... we'll drain the queue when we've successfully subscribed
		// to the current channels being processed
		if (this._subscriptionsPending) {
			this._debug("Subscriptions are pending, channels will be queued");
			if (!this._online) {
				this._debug("Pubnub Connection is offline");
				this.offline(); // emit an Offline event even though the client should already "know", just to be communicative
			}
			this.queueChannels(channelDescriptors);
		} else {
			this.subscribeToChannels(channelDescriptors);
		}
	}

	// unsubscribe to the passed channels
	unsubscribe(channels: string[]) {
		this._debug("Request to unsubscribe from these channels", channels);
		this.removeChannels(channels);
	}

	// turn every channel, even if specified by channel name, into a ChannelDescriptor
	private normalizeChannelDescriptors(
		channels: (ChannelDescriptor | string)[]
	): ChannelDescriptor[] {
		return channels.map(channel => {
			if (typeof channel === "string") {
				return { name: channel };
			} else {
				return channel;
			}
		});
	}

	// we're not in a position to subscribe to these channels, queue them up for later
	private queueChannels(channels: ChannelDescriptor[]) {
		if (this._testMode) {
			this.emitStatus(PubnubStatus.Queued, channels.map(channel => channel.name));
		}
		this._debug("Queueing " + channels);
		this._queuedChannels.push(...channels);
	}

	// a request was made to subscribe to some channels but we weren't ready to handle them,
	// now we are, so drain the queue and subscribe to those channels
	private drainQueue() {
		const channels = this._queuedChannels;
		if (channels.length) {
			this._debug("Draining subscription queue", channels);
		}
		this._queuedChannels = [];
		this.subscribeToChannels(channels);
	}

	// for now, we're accepting online/offline events from the client, but how this will
	// really work is TBD
	setOnline(online: boolean) {
		const wasOnline = this._online;
		this._online = online;
		if (online && !wasOnline) {
			this._debug("Came online, confirming subscriptions...");
			// if we come online after a period of being offline, we'll confirm that our
			// subscriptions are still in good standing by calling Pubnub's hereNow, which
			// tells us who is subscribed to which channels
			this.confirmSubscriptions();
		} else if (!online && wasOnline) {
			this._debug("Went offline");
			// if we're offline, go into a waiting mode until we come online again
			this.offline();
		}
	}

	// add listeners for Pubnub status updates, messages, and presence updates
	private addListener() {
		this._listener = {
			presence: this.onPresence.bind(this),
			message: this.onMessage.bind(this),
			status: this.onStatus.bind(this)
		} as Pubnub.ListenerParameters;
		this._pubnub!.addListener(this._listener);
	}

	// start a ticking clock ... we tick once per second, but if we detect a gap in ticks of
	// longer than 10 seconds, that typically means a computer put on standby or a laptop close ...
	// in this case, the tick gap is usually our quickest way of detecting that we may have
	// some catching up to do once the network connection is restored
	private startTicking() {
		this._tickInterval = setInterval(this.tick.bind(this), 1000);
	}

	// one tick of the clock, if longer than 10 seconds, assume a network "hiccup" of some kind
	private tick() {
		const now = Date.now();
		if (this._lastTick > 0 && now - this._lastTick > 10000) {
			this._debug(`Long tick detected (${now - this._lastTick})`);
			this.netHiccup();
		}
		this._lastTick = now;
	}

	// for test purposes, simulate a long tick (since we can't physically close a laptop!)
	simulateLongTick() {
		clearInterval(this._tickInterval!);
		delete this._tickInterval;
		setTimeout(this.startTicking.bind(this), 11000);
	}

	// remove Pubnub listeners we set up earlier
	private removeListener() {
		if (this._pubnub && this._listener) {
			this._pubnub.removeListener(this._listener);
		}
	}

	simulateOffline(doSimulate?: boolean) {
		this._simulateOffline = doSimulate || typeof doSimulate === "undefined";
	}

	// when a message is received from Pubnub...
	private onMessage(event: Pubnub.MessageEvent) {
		if (this._simulateOffline) {
			// simulating offline condition, ignore messages
			return;
		}
		// track the last time a message was received, each time we encounter a disconnected situation,
		// we'll fetch the message history from this point going forward
		const receivedAt = this.timetokenToTimestamp(event.timetoken);
		this._debug("Pubnub message received at", receivedAt);
		if (receivedAt > this._lastMessageReceivedAt) {
			this._lastMessageReceivedAt = receivedAt;
			this._debug("_lastMessageReceivedAt updated");
		}
		
		// we avoid sending duplicate messages up the chain by maintaining a list of the messages
		// we've already received, dropping duplicates to the floor
		const { messageId } = event.message;
		if (
			!messageId ||
			!this._messagesReceived[messageId]
		) {
			if (messageId) {
				this._messagesReceived[messageId] = Date.now();
			}
			this.emitMessages([event.message]);
		}
		this.cleanUpMessagesReceived();
	}

	// presence event from Pubnub
	private onPresence(event: Pubnub.PresenceEvent) {
		// TODO
	}

	// simulate a subscription timeout on the next subscription event, for testing
	simulateSubscriptionTimeout() {
		this._simulateSubscriptionTimeout = true;
	}

	// respond to a Pubnub status event
	private onStatus(status: Pubnub.StatusEvent | any) {
		this._debug("Pubnub status received", status);
		if ((status as any).error && status.operation === Pubnub.OPERATIONS.PNUnsubscribeOperation) {
			// ignore any errors associated unsubscribing
			return;
		} else if (
			!(status as any).error &&
			status.operation === Pubnub.OPERATIONS.PNSubscribeOperation &&
			status.category === Pubnub.CATEGORIES.PNConnectedCategory
		) {
			if (!this._simulateSubscriptionTimeout) {
				// a successful subscription of certain channels
				this.setConnected(status.subscribedChannels);
			} else {
				this._simulateSubscriptionTimeout = false;
			}
		} else if (
			(status as any).error &&
			status.category === Pubnub.CATEGORIES.PNAccessDeniedCategory
		) {
			// an access denied message, in direct response to a subscription attempt
			let response;
			try {
				response = JSON.parse((status as any).errorData.response.text);
			} catch (error) {
				// this is really a total failsafe, but if we can't determine the payload
				// for some reason, we assume the worst
				this._debug("Could not parse AccessDenied response");
				this.emitTrouble();
				this.resubscribe();
				return;
			}
			// we'll explicitly force the server to grant us permission to access these channels,
			// hoping that this is just a glitch or delay
			this.subscriptionFailure(response.payload.channels || []);
		} else if (
			!this._subscriptionsPending &&
			(status as any).error &&
			(status.operation === Pubnub.OPERATIONS.PNHeartbeatOperation ||
				status.operation === Pubnub.OPERATIONS.PNSubscribeOperation)
		) {
			// a network error of some kind, we'll confirm our subscriptions and
			// make sure we are truly connected
			this.netHiccup();
		}
		/* This doesn't work ... maybe in the browser, but in the agent, we never get the PNNetworkUpCategory,
   so we never get out of Offline mode
		else if (status.category === Pubnub.CATEGORIES.PNNetworkDownCategory) {
			this.setOnline(false);
		}
		else if (status.category === Pubnub.CATEGORIES.PNNetworkUpCategory) {
			this.setOnline(true);
		}
*/
	}

	// for testing purposes, simulate a Pubnub status event which indicates a network error
	simulateNetError(delay: number = 0) {
		setTimeout(() => {
			this.onStatus({
				error: true,
				operation: Pubnub.OPERATIONS.PNHeartbeatOperation
			});
		}, delay);
	}

	// subscribe to these channels
	private subscribeToChannels(channels: ChannelDescriptor[]) {
		// add them as unsubscribed, then subscribe to unsubscribed channels
		const numAdded = this.addChannels(channels);
		if (numAdded > 0) {
			// this says we need to notify the client when we get fully connected
			this._needConnectedMessage = true;
		}
		this._debug("Channels were added, ensuring subscription to all channels...");
		this.subscribeAll();
	}

	// subscribe to all requested channels that we are not yet subscribed to
	private subscribeAll() {
		if (!this._online) {
			// can't subscribe if we are offline, enter into an offline state and
			// wait to go online again
			this._debug("Not online to subscribe");
			return this.offline();
		}
		const channels = this.getUnsubscribedChannels();
		this._debug("Unsubscribed channels are", channels);
		if (channels.length === 0) {
			// no unsubscribed channels, just say we're fully subscribed
			this._debug("No unsubscribed channels, we are fully subscribed");
			return this.subscribed();
		}

		// split into channels that require presence updates and those that don't, and
		// make a separate call to Pubnub to subscribe for each
		const channelsWithPresence: string[] = [];
		const channelsWithoutPresence: string[] = [];
		channels.forEach(channel => {
			if (this._subscriptions[channel].withPresence) {
				channelsWithPresence.push(channel);
			} else {
				channelsWithoutPresence.push(channel);
			}
			// remove this channel from list of active failures, since we are trying again
			const index = this._activeFailures.indexOf(channel);
			if (index !== -1) {
				this._activeFailures.splice(index, 1);
			}
		});
		if (channelsWithPresence.length > 0) {
			this._debug("Pubnub subscribing (with presence) to", channelsWithPresence);
			this._pubnub!.subscribe({
				channels: channelsWithPresence,
				withPresence: true
			} as Pubnub.SubscribeParameters);
		}
		if (channelsWithoutPresence.length > 0) {
			this._debug("Pubnub subscribing to", channelsWithoutPresence);
			this._pubnub!.subscribe({
				channels: channelsWithoutPresence
			} as Pubnub.SubscribeParameters);
		}

		// it sucks that we don't get a direct response from Pubnub when we try to
		// subscribe to channels ... when we get a failure, we're not told which channels
		// failed ... so avoid race condition problems by explicitly timing out if we
		// don't receive a success message
		if (!this._statusTimeout) {
			this._debug("Pubnub subscriptions timing out in 5s...");
			this._statusTimeout = setTimeout(this.subscriptionTimeout.bind(this), 5000);
		}
	}

	// add channels to our list of channels we know we need to subscribe to, mark them
	// as unsubscribed unless we already know about them
	private addChannels(channels: ChannelDescriptor[]): number {
		let numAdded = 0;
		for (const channel of channels) {
			if (!this._subscriptions[channel.name]) {
				this._subscriptions[channel.name] = {
					subscribed: false,
					withPresence: channel.withPresence || false
				};
				numAdded++;
				this._subscriptionsPending = true;
			}
		}
		return numAdded;
	}

	// set the given channels as successfully subscribed to, and if we're subscribed to
	// all channels that have been requested, catch up on any missed history and emit
	// a Connected event when done
	private setConnected(channels: string[]) {
		this._debug("These channels are connected", channels);
		const newlyConnected: string[] = [];
		for (const channel of channels) {
			if (!this._subscriptions[channel].subscribed) {
				this._subscriptions[channel].subscribed = true;
				newlyConnected.push(channel);
			}
		}
		if (this.getUnsubscribedChannels().length === 0) {
			this._debug("No more unsubscribed channels");
			clearTimeout(this._statusTimeout!);
			delete this._statusTimeout;
		}
		this._debug("Catching up on these channels", newlyConnected);
		this.catchUp(newlyConnected);
	}

	// force-set the last message received timestamp, for testing catch-up
	setLastMessageReceivedAt(lastMessageReceivedAt: number) {
		this._lastMessageReceivedAt = lastMessageReceivedAt;
	}

	// catch up on missed history, while disconnected
	private async catchUp(channels: string[]) {
		// catch up since the last message received, or, if we are caught in a loop
		// of trying to catch up already, continue to catch up from that point
		let since = 0;
		if (this._catchingUpSince > 0) {
			since = this._catchingUpSince;
			this._debug(`Already catching up since ${this._catchingUpSince}`);
		} else if (this._lastMessageReceivedAt > 0) {
			since = this._lastMessageReceivedAt - THRESHOLD_BUFFER;
			this._debug(`Last message was recevied at ${this._lastMessageReceivedAt}`);
		}
		if (!since) {
			// assume a fresh session, with no catch up necessary
			this._debug("No messages have been received yet, assume fresh session");
			this._lastMessageReceivedAt = Date.now();
			return this.subscribed();
		}
		if (Date.now() - since > THRESHOLD_FOR_CATCHUP) {
			// if it's been too long, we don't want to process a whole ton of messages,
			// and in any case we only retain messages for one month ... so better to
			// force the client to initiate a fresh session
			this._debug("Been away for too long, forcing reset");
			this._catchingUpSince = 0;
			return this.reset();
		}

		if (channels.length === 0) {
			this._debug("No channels to catch up with");
			if (this.getUnsubscribedChannels().length === 0) {
				this._debug("And no channels at all, no catch-up is needed");
				// if no channels, we just assume we're fully subscribed
				this._catchingUpSince = 0;
				this.subscribed();
			}
			return;
		}

		// fetch history since the last message received
		let historyOutput: PubnubHistoryOutput;
		try {
			this._debug(`Fetching history since ${since} for`, channels);
			historyOutput = await new PubnubHistory().fetchHistory({
				pubnub: this._pubnub,
				channels,
				since
			} as PubnubHistoryInput);
		} catch (error) {
			// this is bad ... if we can't catch up on history, we'll start
			// with a clean slate and try to resubscribe all over again
			error = error instanceof Error ? error.message : error;
			this._debug("Fetch history error, resubscribing...", error);
			this.emitTrouble();
			return this.resubscribe(channels);
		}
		if (historyOutput.reset) {
			this._debug("Too much history, forcing reset");
			// if in fetching history we found there were too many messages, we don't
			// want to over-burden the client with processing, better just to force
			// a fresh session
			return this.reset();
		} else if (historyOutput.messages && historyOutput.messages.length > 0) {
			// emit all messages found and update to timestamp of last message received
			this._lastMessageReceivedAt = historyOutput.timestamp!;
			this._debug(
				`${historyOutput.messages.length} messages received from history`,
				historyOutput.messages
			);
			this._debug(`_lastMessageReceivedAt updated to ${historyOutput.timestamp}`);
			this.emitMessages(historyOutput.messages);
		}

		// nothing left to do ... we are successfully subscribed to all channels!
		this._debug("Caught up!");
		this._catchingUpSince = 0;
		this.subscribed();
	}

	// we detected a network hiccup of some kind, detect whether we are offline,
	// and if so, go into a waiting mode, otherwise confirm our subscriptions are still
	// in good standing
	private async netHiccup() {
		this._subscriptionsPending = true;
		if (this._testMode) {
			this.emitStatus(PubnubStatus.NetworkProblem);
		}
		this._debug("Network hiccup");
		if (!this._online) {
			this._debug("And we are offline");
			this.offline();
		} else if (this._activeFailures.length > 0) {
			this._debug("There are active failures in progress, ignore network hiccup");
		} else {
			this._debug("Confirm subscriptions...");
			this.confirmSubscriptions();
		}
	}

	// simulate a failure to confirm subscriptions, for testing purposes
	simulateConfirmFailure(doSimulate?: boolean) {
		this._simulateConfirmFailure = doSimulate || typeof doSimulate === "undefined";
	}

	// confirm our subscriptions are in good standing by calling Pubnub's hereNow(),
	// which tells us which users are subscribed to which channels ... make sure
	// we're in all the expected channels, and if we aren't, resubscribe to them
	private async confirmSubscriptions() {
		const channels = this.getSubscribedChannels();
		if (channels.length === 0) {
			// no subscribed channels to worry about, proceed through the state machine
			// to a subscribed state again
			this._debug("No subscribed channels to confirm, assume we are fully subscribed");
			return this.subscribed();
		}

		// look for the occupants of the given channels, and if we are not among
		// them, something has gone wrong and we must resubscribe
		let response: Pubnub.HereNowResponse;
		let gotError = false;
		try {
			if (this._simulateConfirmFailure) {
				throw new Error("error");
			}
			this._debug("Confirming subscription to", channels);
			response = await this._pubnub!.hereNow({
				channels,
				includeUUIDs: true
			} as Pubnub.HereNowParameters);
		} catch (error) {
			this._debug("Error confirming subscriptions", error);
			gotError = true;
		}
		let troubleChannels;
		if (gotError || !response! || !response!.channels) {
			troubleChannels = channels;
		} else {
			troubleChannels = channels.filter(channel => {
				return (
					!response.channels[channel] ||
					!response.channels[channel].occupants.find(occupant => occupant.uuid === this._userId)
				);
			});
			if (troubleChannels.length > 0) {
				this._debug("Unable to confirm subscription to", troubleChannels);
			}
		}
		if (troubleChannels.length > 0) {
			// let the client know we're experiencing difficulty, and attempt to resubscribe to
			// the channels in question
			this._debug("Failed to confirm all subscriptions, resubscribing...");
			this.emitTrouble(troubleChannels);
			this.resubscribe(troubleChannels);
		} else {
			if (this._testMode) {
				this.emitStatus(PubnubStatus.Confirmed);
			}
			// seems like we're good, let's make sure we didn't miss anything by catching up on
			// message history
			this._debug("Subscriptions confirmed, reconnect and catch up...");
			(this._pubnub! as any).reconnect();
			this.catchUp(this.getSubscribedChannels());
		}
	}

	// unsubscribe to all channels and stop listening to messages and status updates (clean up)
	private unsubscribeAll() {
		const channels = this.getSubscribedChannels();
		this._debug("Pubnub unsubscribing", channels);
		this._pubnub!.unsubscribe({ channels });
		this._subscriptions = {};
		this.removeListener();
		if (this._tickInterval) {
			clearInterval(this._tickInterval);
		}
		if (this._statusTimeout) {
			clearTimeout(this._statusTimeout!);
		}
	}

	// we timed out trying to successfully subscribe to one or more channels, enter into a failure
	// mode, ask the api server to explicitly grant us subscription access to those channels,
	// and try again
	private async subscriptionTimeout() {
		delete this._statusTimeout;
		const failedChannels = this.getUnsubscribedChannels();
		this._debug("Subscription timed out for", failedChannels);
		await this.subscriptionFailure(failedChannels);
	}

	// simulate a failure to grant access to a channel, for testing
	simulateGrantFailure(which?: boolean | string | string[]) {
		if (typeof which === "string") {
			which = [which];
		}
		this._simulateGrantFailure = which || typeof which === "undefined";
	}

	// we never successfully subscribed to one or more channels requested, enter into a failure
	// mode, ask the api server to explicitly grant us subscription access to those channels,
	// and try again
	private async subscriptionFailure(failedChannels: string[]) {
		let channels = failedChannels.filter(channel => !this._activeFailures.includes(channel));
		if (channels.length === 0) {
			this._debug("Already handling subscription failures, ignoring", failedChannels);
			return;
		}
		this._activeFailures = [...this._activeFailures, ...channels];
		this.emitTrouble(channels);
		this._grantFailures = [];
		await Promise.all(
			channels.map(async channel => {
				await this.grantChannel(channel);
			})
		);
		this._debug("Subscription failure for", channels);
		if (this._grantFailures.length > 0) {
			// if we are unable to get explicit access to any channels, something is really wrong,
			// so notify the client of the failures so it can take whatever action, and remove
			// those channels from our list of channels to try, we're writing them off and the
			// client is going to have to figure out what to do about it
			this._debug("Grant failures, these channels will be removed", channels);
			this.emitFailures(this._grantFailures);
			this.removeChannels(this._grantFailures);
			channels = channels.filter(channel => !this._grantFailures.includes(channel));
		} else if (this._testMode) {
			this.emitStatus(PubnubStatus.Granted, channels);
		}

		// if we have been granted access by the API server to all channels, but we haven't
		// actually subscribed to any channels, we'll retry 10 times ... after that, we
		// emit a total failure and stop accepting subscription requests ... this is the
		// only way to abort an infinite loop if the Pubnub token was just plain wrong
		if (
			this._grantFailures.length === 0 &&
			this.getSubscribedChannels().length === 0 &&
			this._lastSuccessfulSubscription === 0
		) {
			if (this._numResubscribes >= 10) {
				this._debug(
					"All subscriptions so far have failed after 10 retries, going into aborted mode..."
				);
				this._aborted = true;
				this.unsubscribeAll();
				return this.emitStatus(PubnubStatus.Aborted);
			}
		}

		if (channels.length === 0) {
			this.subscribed();
		} else {
			const interval = this.getThrottleInterval();
			this._debug(`Resubscribing in ${interval} ms...`);
			setTimeout(() => {
				this.resubscribe(channels);
			}, interval);
		}
	}

	// ask the api server to explicitly grant us access to the given channel, if we don't
	// get access, something is wrong, and the client will have to know about it
	private async grantChannel(channel: string) {
		try {
			if (
				this._simulateGrantFailure === true ||
				(this._simulateGrantFailure instanceof Array &&
					this._simulateGrantFailure.includes(channel))
			) {
				throw new ServerError("invalid token", { code: "RAPI-1009" }, 403);
			}
			this._debug("Explicitly requesting access for", channel);
			await this._api!.grant(this._accessToken!, channel);
		} catch (error) {
			this._debug("Grant error", error);
			// a RAPI-1009 error from the server is an explicit refusal to grant access
			// to this channel, so we won't try with this channel anymore
			// for all other possible errors, we will keep trying
			if (
				error instanceof ServerError &&
				error.statusCode === 403 &&
				error.info &&
				(error.info.code === "RAPI-1009" || error.info.code === "USRC-1008")
			) {
				this._debug("Server explicitly refused access", channel);
				this._grantFailures.push(channel);
			}
		}
	}

	// we're finally subscribed to all channels requested, and are caught up on messages
	private subscribed() {
		// if there are more channels waiting to be subscribed to in the queue, drain the
		// queue and subscribe to those channels, otherwise simply emit a Connected event,
		// indicating we're good to go
		if (this._queuedChannels.length > 0) {
			this._debug(
				"Successfully subscribed, but there are additional subscriptions in queue, draining queue..."
			);
			this.drainQueue();
		} else {
			this._activeFailures = [];
			this._subscriptionsPending = false;
			if (this.getSubscribedChannels().length > 0) {
				this._debug("Subscription successful", this.getSubscribedChannels());
				this._lastSuccessfulSubscription = Date.now();
				this._numResubscribes = 0;
			}
			// we only need to emit the message that we are connected under two conditions:
			// either the client added channels (so they need to know they subscribed successfully),
			// or we encountered network trouble and told them about it (with emitTrouble()),
			// so they need to know we resubscribed successfully
			if (this._needConnectedMessage) {
				this.emitConnected();
			}
		}
	}

	// emit a status update to the client, with channels of interest optionally specified
	private emitStatus(status: PubnubStatus, channels?: string[]) {
		this._debug(`Emitting status ${status}`, channels);
		this._statusEmitter.fire({
			status: status,
			channels: channels
		});
	}

	// emit a Connected event, letting the client know about all the channels we're now
	// subscribed to
	private emitConnected() {
		const channels = this.getAllChannels();
		this.emitStatus(PubnubStatus.Connected, channels);
		this._needConnectedMessage = false;
	}

	// emit a Trouble event, indicating we're having trouble subscribing to one or more
	// channels, so the client can display something to the user as needed
	private emitTrouble(channels?: string[]) {
		this._debug("We are in trouble");
		// this says we need to notify the client when we get fully connected (again)
		this._needConnectedMessage = true;
		this.emitStatus(PubnubStatus.Trouble, channels);
	}

	// let the client know we were unable to subscribe to a given set of channels, and
	// moreover that we were unable to even get the server to give us access to those
	// channels ... something is wrong in this case and we'll no longer attempt to
	// subscribe to those channels
	private emitFailures(channels: string[]) {
		this.emitStatus(PubnubStatus.Failed, channels);
	}

	// get all known channels to which we are being asked to subscribe
	private getAllChannels(): string[] {
		return Object.keys(this._subscriptions);
	}

	// get all channels that we are actively subscribed to
	private getSubscribedChannels(): string[] {
		return Object.keys(this._subscriptions).filter(channel => {
			return this._subscriptions[channel].subscribed;
		});
	}

	// get all channels that we are not yet subscribed to
	private getUnsubscribedChannels(): string[] {
		return Object.keys(this._subscriptions).filter(channel => {
			return !this._subscriptions[channel].subscribed;
		});
	}

	// emit an Offline event, indicating we are currently not connected to the network
	private offline() {
		this.emitStatus(PubnubStatus.Offline);
	}

	// resubscribe to all channels
	private resubscribe(channels?: string[]) {
		if (!channels) {
			channels = Object.keys(this._subscriptions);
		}
		this._numResubscribes++;
		this._debug("Set numResubscribes to " + this._numResubscribes);
		channels.forEach(channel => {
			this._subscriptions[channel].subscribed = false;
		});
		this._debug("Resubscribing to", channels);
		// this._pubnub!.unsubscribeAll();
		this._subscriptionsPending = true;
		// also drain the queue and add any queued channels to the list, since we're
		// starting from scratch on all of them anyway
		this.drainQueue();
	}

	// emit a Reset event, indicating to the client that we have too many messages to
	// fetch to catch up on messages, and that it would be better for the client to
	// initiate a fresh session ... in doing this, we'll unsubscribe to all channels,
	// since it is expected that the client will initiate new subscriptions after
	// resetting the session
	private reset() {
		this.unsubscribeAll();
		this.emitStatus(PubnubStatus.Reset);
	}

	// remove the given set of channels from our list of channels to which we are
	// trying to subscribe
	private removeChannels(channels: string[]) {
		this._pubnub!.unsubscribe({ channels });
		for (const channel of channels) {
			delete this._subscriptions[channel];
		}
	}

	// to throttle resubscribe attempts, determine the next interval to wait until resubscribe
	private getThrottleInterval() {
		if (this._numResubscribes < 10) {
			return 0;
		} else if (this._numResubscribes < 100) {
			return 1000;
		} else {
			return 60000;
		}
	}

	// emit Pubnub messages to the client
	private emitMessages(messages: { [key: string]: any }[]) {
		this._messageEmitter.fire(messages);
	}

	// convert from Pubnub time token to unix timestamp
	private timetokenToTimestamp(timetoken: string): number {
		return Math.floor(parseInt(timetoken, 10) / 10000);
	}

	// clean up our ongoing tracking of messages received
	private cleanUpMessagesReceived () {
		// we'll clean up any record of messages received more than ten minutes old
		const cutoff = Date.now() - 10 * 60 * 1000;
		Object.keys(this._messagesReceived).forEach(messageId => {
			if (this._messagesReceived[messageId] < cutoff) {
				delete this._messagesReceived[messageId];
			}
		});
	}
}
