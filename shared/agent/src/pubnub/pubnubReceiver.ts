// Provide the PubnubReceiver class, which encapsulates communications with Pubnub to receive
// messages in real-time 

import { Disposable, Emitter, Event } from "vscode-languageserver/lib/main";
import * as Pubnub from "pubnub";
import { PubnubHistory, PubnubHistoryInput, PubnubHistoryOutput } from "./pubnubHistory";

// use this interface to initialize the PubnubReceiver class
export interface PubnubInitializer {
	subscribeKey: string,	// identifies our Pubnub account, comes from pubnubKey returned with the login response from the API
	authKey: string,		// unique Pubnub token provided in the login response
	userId: string,			// ID of the current user
	channels?: Array<ChannelDescriptor | string>,	// channels to subscribe to, provided on initialization or later using subscribe()
	lastMessageReceivedAt?: number,	// should persist across sessions, interruptions in service will retrieve messages since this time
	online?: boolean	// for now, whether the network is online is tracked from without the PubnubReceiver instance, but this is still TBD
}

// when providing channels to subscribe to, you can provide just the channel name,
// or if you want presence notifications, you can use this interface, specifying
// withPresence as true
export interface ChannelDescriptor {
	name: string,
	withPresence?: boolean
}

// the PubnubReceiver instance will emit a status through onStatusChange(), for some
// statuses, information on which channels are affected is also provided
export interface StatusChangeEvent {
	status: PubnubStatus,
	channels?: Array<string>
}

// one of the statuses emitted in StatusChangeEvent above
export enum PubnubStatus {
	Connected,	// indicates all channels have been successfully subscribed to as requested
	Trouble,	// indicates trouble with the network or one or more subscriptions, should be a temporary state
	SomeFailed,	// indicates some channels could not be subscribed to, and client action is required to correct this
	Failed,		// indicates a complete failure to subscribe, in practice this should never occur
	Offline,	// indicates the network is currently offline, so messages won't be received
	Reset		// indicates that during catching up on history, there are too many messages or it's been too long...
				// the client should retrieve fresh data from the server as if it is a fresh login
}

// internal, maintains map of channels and whether they are yet successfully subscribed
interface SubscriptionMap {
	[key: string]: {
		subscribed: boolean,
		withPresence?: boolean
	}
}

// PubNub's retention time is one week ... to avoid missing messages on the edge, we'll
// not try to catch up if we are within ten minutes of that
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;
const THRESHOLD_FOR_CATCHUP = ONE_WEEK - TEN_MINUTES;

export class PubnubReceiver {

	private _fullySubscribed: boolean = false;
	private _subscriptions: SubscriptionMap = {};
	private _userId: string | undefined;
	private _subscribeKey: string | undefined;
	private _authKey: string | undefined;
	private _pubnub: Pubnub | undefined;
	private _lastMessageReceivedAt: number = 0;
	private _listener: Pubnub.ListenerParameters | undefined;
	private _messageEmitter = new Emitter<Array<any>>();
	private _statusEmitter = new Emitter<StatusChangeEvent>();
	private _queuedChannels: Array<ChannelDescriptor> = [];
	private _statusTimeout: NodeJS.Timer | undefined;
	private _online: boolean = false;
	private _grantFailures: Array<string> = [];
	private _lastTick: number = 0;
	private _tickInterval: NodeJS.Timer | undefined;

	// call to receive status updates
	get onStatusChange(): Event<StatusChangeEvent> {
		return this._statusEmitter.event;
	}

	// call to listen for Pubnub messages
	get onMessagesReceived(): Event<Array<any>> {
		return this._messageEmitter.event;
	}

	// initialize PubnubReceiver and optionally subscribe to channels
	initialize (options: PubnubInitializer): Disposable {
		this._subscribeKey = options.subscribeKey;
		this._authKey = options.authKey;
		this._userId = options.userId;
		this._lastMessageReceivedAt = options.lastMessageReceivedAt || 0;
		this._online = options.online || false;

		const channels = options.channels || [];
		const channelDescriptors = this.normalizeChannelDescriptors(channels);
		this.addChannels(channelDescriptors);

		this._pubnub = new Pubnub({
			authKey: this._authKey,
			uuid: this._userId,
			subscribeKey: this._subscribeKey,
			restore: true,
			logVerbosity: false,
			heartbeatInterval: 30
		} as Pubnub.PubnubConfig);

		this.addListener();
		this.startTicking();

		this.subscribeAll();

		return {
			dispose: () => {
				this.unsubscribeAll();
			}
		};
	}

	// subscribe to the passed channels
	subscribe (channels: Array<ChannelDescriptor | string>) {
		const channelDescriptors: Array<ChannelDescriptor> = this.normalizeChannelDescriptors(channels);
		// while processing subscriptions, we hold off accepting new subscriptions until processing is complete,
		// in the meantime, queue them up ... we'll drain the queue when we've successfully subscribed
		// to the current channels being processed
		if (!this._fullySubscribed) {
			if (!this._online) {
				this.offline();	// emit an Offline event even though the client should already "know", just to be communicative
			}
			this.queueChannels(channelDescriptors);
		}
		else {
			this.subscribeToChannels(channelDescriptors);
		}
	}

	// turn every channel, even if specified by channel name, into a ChannelDescriptor 
	private normalizeChannelDescriptors (channels: Array<ChannelDescriptor | string>): Array<ChannelDescriptor> {
		return channels.map(channel => {
			if (typeof channel === 'string') {
				return { name: channel };
			}
			else {
				return channel;
			}
		});
	}

	// we're not in a position to subscribe to these channels, queue them up for later
	private queueChannels (channels: Array<ChannelDescriptor>) {
		this._queuedChannels.push(...channels);
	}

	// a request was made to subscribe to some channels but we weren't ready to handle them,
	// now we are, so drain the queue and subscribe to those channels
	private drainQueue () {
		const channels = this._queuedChannels;
		this._queuedChannels = [];
		this.subscribeToChannels(channels);
	}

	// for now, we're accepting online/offline events from the client, but how this will
	// really work is TBD
	setOnline (online: boolean) {
		const wasOnline = this._online;
		this._online = online;
		if (online && !wasOnline) {
			// if we come online after a period of being offline, we'll confirm that our
			// subscriptions are still in good standing by calling Pubnub's hereNow, which
			// tells us who is subscribed to which channels
			this.confirmSubscriptions();
		}
		else if (!online && wasOnline) {
			// if we're offline, go into a waiting mode until we come online again
			this.offline();
		}
	}

	// add listeners for Pubnub status updates, messages, and presence updates
	private addListener () {
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
	private startTicking () {
		this._tickInterval = setInterval(this.tick.bind(this), 1000);
	}

	// one tick of the clock, if longer than 10 seconds, assume a network "hiccup" of some kind
	private tick () {
		const now = Date.now();
		if (this._lastTick > 0 && now - this._lastTick > 10000) {
			this.netHiccup();
		}
		this._lastTick = now;
	}

	// for test purposes, simulate a long tick (since we can't physically close a laptop!)
	simulateLongTick () {
		clearInterval(this._tickInterval!);
		setTimeout(this.startTicking.bind(this), 11000);
	}

	// remove Pubnub listeners we set up earlier
	private removeListener () {
		if (this._pubnub && this._listener) {
			this._pubnub.removeListener(this._listener);
		}
	}

	// when a message is received from Pubnub...
	private onMessage (event: Pubnub.MessageEvent) {
		// track the last time a message was received, each time we encounter a disconnected situation,
		// we'll fetch the message history from this point going forward
		this._lastMessageReceivedAt = this.timetokenToTimestamp(event.timetoken);
		this._messageEmitter.fire([event.message]);
	}

	// presence event from Pubnub
	private onPresence(event: Pubnub.PresenceEvent) {
		// TODO
	}

	// respond to a Pubnub status event
	private onStatus(status: Pubnub.StatusEvent | any) {
		if (
			!(status as any).error &&
			status.operation === Pubnub.OPERATIONS.PNSubscribeOperation &&
			status.category === Pubnub.CATEGORIES.PNConnectedCategory
		) {
			// a successful subscription of certain channels
			this.setConnected(status.affectedChannels);
		}
		else if (
			this._fullySubscribed && 
			(status as any).error &&
			(
				status.operation === Pubnub.OPERATIONS.PNHeartbeatOperation ||
				status.operation === Pubnub.OPERATIONS.PNSubscribeOperation
			)
		) {
			// a network error of some kind, we'll confirm our subscriptions and
			// make sure we are truly connected
			this.netHiccup();
		}
		else if (
			(status as any).error &&
			status.category === Pubnub.CATEGORIES.PNAccessDeniedCategory
		) {
			// an access denied message, in direct response to a subscription attempt
			let response;
			try {
				response = JSON.parse((status as any).errorData.response.text);
			}
			catch (error) {
				// this is really a total failsafe, but if we can't determine the payload
				// for some reason, we assume the worst
				this.subscriptionFailureAll();
				return;
			}
			// we'll explicitly force the server to grant us permission to access these channels,
			// hoping that this is just a glitch or delay 
			this.subscriptionFailure(response.payload.channels || []);
		}
	}

	// for testing purposes, simulate a Pubnub status event which indicates a network error
	simulateNetError (delay: number = 0) {
		setTimeout(() => {
			this.onStatus({
				error: true,
				operation: Pubnub.OPERATIONS.PNHeartbeatOperation
			});
		}, delay);
	}
	
	// subscribe to these channels
	private subscribeToChannels (channels:Array<ChannelDescriptor>) {
		// add them as unsubscribed, then subscribe to unsubscribed channels
		this.addChannels(channels);
		this.subscribeAll();
	}

	// subscribe to all requested channels that we are not yet subscribed to
	private subscribeAll () {
		if (!this._online) {
			// can't subscribe if we are offline, enter into an offline state and 
			// wait to go online again
			return this.offline();
		}
		const channels = this.getUnsubscribedChannels();
		if (Object.keys(channels).length === 0) {
			// no unsubscribed channels, just do a catch up on messages
			return this.catchUp();
		}

		// split into channels that require presence updates and those that don't, and
		// make a separate call to Pubnub to subscribe for each
		const timetoken = this.timestampToTimetoken(this._lastMessageReceivedAt - 10000);
		const channelsWithPresence: Array<string> = [];
		const channelsWithoutPresence: Array<string> = [];
		channels.forEach(channel => {
			if (this._subscriptions[channel].withPresence) {
				channelsWithPresence.push(channel);
			}
			else {
				channelsWithoutPresence.push(channel);
			}
		});
		if (channelsWithPresence.length > 0) {
			this._pubnub!.subscribe({
				channels: channelsWithPresence,
				withPresence: true,
				timetoken
			} as Pubnub.SubscribeParameters);
		}
		if (channelsWithoutPresence.length > 0) {
			this._pubnub!.subscribe({
				channels: channelsWithoutPresence,
				timetoken
			} as Pubnub.SubscribeParameters);
		}

		// it sucks that we don't get a direct response from Pubnub when we try to 
		// subscribe to channels ... when we get a failure, we're not told which channels
		// failed ... so avoid race condition problems by explicitly timing out if we
		// don't receive a success message 
		this._statusTimeout = setTimeout(this.subscriptionTimeout.bind(this), 5000);
	}

	// add channels to our list of channels we know we need to subscribe to, mark them
	// as unsubscribed unless we already know about them
	private addChannels (channels: Array<ChannelDescriptor>) {
		for (let channel of channels) {
			if (!this._subscriptions[channel.name]) {
				this._subscriptions[channel.name] = {
					subscribed: false,
					withPresence: channel.withPresence || false
				};
				this._fullySubscribed = false;
			}
		}
	}

	// set the given channels as successfully subscribed to, and if we're subscribed to
	// all channels that have been requested, catch up on any missed history and emit
	// a Connected event when done
	private setConnected (channels: Array<string>) {
		for (let channel of channels) {
			this._subscriptions[channel].subscribed = true;
		}
		if (this.getUnsubscribedChannels().length === 0) {
			clearTimeout(this._statusTimeout!);
			this.catchUp();
		}
	}

	// catch up on missed history, while disconnected
	private async catchUp () {
		if (!this._lastMessageReceivedAt) {
			// if _lastMessageReceivedAt is not set, we assume a fresh session, with no
			// catch up necessary
			return this.subscribed();
		}
		if (Date.now() - this._lastMessageReceivedAt > THRESHOLD_FOR_CATCHUP) {
			// if it's been too long, we don't want to process a whole ton of messages,
			// and in any case we only retain messages for one week ... so better to 
			// force the client to initiate a fresh session
			return this.reset();
		}

		const channels = this.getSubscribedChannels();
		if (channels.length === 0) {
			// if no channels, we just assume we're fully subscribed
			return this.subscribed();
		}

		// fetch history since the last message received
		let historyOutput: PubnubHistoryOutput;
		try {
			historyOutput = await new PubnubHistory().fetchHistory({
				pubnub: this._pubnub,
				channels,
				since: this._lastMessageReceivedAt
			} as PubnubHistoryInput);
		}
		catch (error) {
			// this is catastrophic ... if we can't catch up on messages, something is
			// badly wrong and some client action will be required
			return this.subscriptionFailureAll();
		}
		if (historyOutput.reset) {
			// if in fetching history we found there were too many messages, we don't
			// want to over-burden the client with processing, better just to force
			// a fresh session
			return this.reset();
		}

		else if (historyOutput.messages && historyOutput.messages.length > 0) {
			// emit all messages found
			this.emitMessages(historyOutput.messages);
		}

		// nothing left to do ... we are successfully subscribed to all channels!
		this.subscribed();
	}

	// we detected a network hiccup of some kind, detect whether we are offline,
	// and if so, go into a waiting mode, otherwise confirm our subscriptions are still 
	// in good standing
	private async netHiccup () {
		if (!this._online) {
			this.offline();
		}
		else {
			this.confirmSubscriptions();
		}
	}

	// confirm our subscriptions are in good standing by calling Pubnub's hereNow(),
	// which tells us which users are subscribed to which channels ... make sure
	// we're in all the expected channels, and if we aren't, resubscribe to them
	private async confirmSubscriptions () {
		const channels = this.getSubscribedChannels();
		if (channels.length === 0) {
			// no subscribed channels to worry about, proceed through the state machine
			// to a subscribed state again
			return this.catchUp();
		}

		// look for the occupants of the given channels, and if we are not among
		// them, something has gone wrong and we must resubscribe
		let response: Pubnub.HereNowResponse;
		let gotError: boolean = false;
		try {
			response = await this._pubnub!.hereNow({
				channels,
				includeUUIDs: true
			} as Pubnub.HereNowParameters);
		}
		catch (error) {
			gotError = true;
		}
		if (
			gotError ||
			channels.find(channel => {
				return !response.channels[channel].occupants.find(occupant => occupant.uuid === this._userId);
			})
		) {
			// let the client know we're experiencing difficulty, and attempt to resubscribe to 
			// the channels in question
			this.emitTrouble();
			this.resubscribe();
		}
		else {
			// seems like we're good, let's make sure we didn't miss anything by catching up on
			// message history
			this.catchUp();
		}
	}

	// unsubscribe to all channels and stop listening to messages and status updates (clean up)
	private unsubscribeAll () {
		const channels = this.getSubscribedChannels();
		this._pubnub!.unsubscribe({ channels });
		this._subscriptions = {};
		this.removeListener();
	}

	// some sort of disaster has happened and we are completely unable to subscribe to any
	// channels, for now, we'll enter into a loop of trying over and over again to resubscribe,
	// but we might need to introduce some throttling into this behavior
	private async subscriptionFailureAll () {
		// let the client know we are experiencing difficulty, ask the api server to explicitly
		// grant us access to all the channels we are supposed to have access to, and try again
		// to resubscribe ... let's hope this process doesn't go on for too long
		this.emitTrouble();
		try {
//			await this._api.grantAll(token);
		}
		catch (error) {
		}
		this.resubscribe();
	}

	// we timed out trying to successfully subscribe to one or more channels, enter into a failure
	// mode, ask the api server to explicitly grant us subscription access to those channels,
	// and try again
	private async subscriptionTimeout () {
		const failedChannels = this.getUnsubscribedChannels();
		await this.subscriptionFailure(failedChannels);
	}

	// we never successfully subscribed to one or more channels requested, enter into a failure
	// mode, ask the api server to explicitly grant us subscription access to those channels,
	// and try again
	private async subscriptionFailure (channels:Array<string>) {
		this.emitTrouble();
		this._grantFailures = [];
		await Promise.all(channels.map(async channel => {
			await this.grantChannel(channel);
		}));
		if (this._grantFailures.length > 0) {
			// if we are unable to get explicit access to any channels, something is really wrong, 
			// so notify the client of the failures so it can take whatever action, and remove
			// those channels from our list of channels to try, we're writing them off and the
			// client is going to have to figure out what to do about it
			this.emitFailures(this._grantFailures);
			this.removeChannels(this._grantFailures);
		}
		this.resubscribe();
	}

	// ask the api server to explicitly grant us access to the given channel, if we don't
	// get access, something is wrong, and the client will have to know about it
	private grantChannel (channel: string) {
		try {
//			await this._api.grant(token, { channel });
		}
		catch (error) {
			this._grantFailures.push(channel);
		}
	}

	// we're finally subscribed to all channels requested, and are caught up on messages
	private subscribed () {
		// if there are more channels waiting to be subscribed to in the queue, drain the
		// queue and subscribe to those channels, otherwise simply emit a Connected event,
		// indicating we're good to go
		if (this._queuedChannels.length > 0) {
			this.drainQueue();
		}
		else {
			this._fullySubscribed = true;
			this.emitConnected();
		}
	}

	// emit a status update to the client, with channels of interest optionally specified
	private emitStatus (status: PubnubStatus, channels?: Array<string>) {
		this._statusEmitter.fire({
			status: status,
			channels: channels
		});
	}

	// emit a Connected event, letting the client know about all the channels we're now
	// subscribed to
	private emitConnected () {
		const channels = this.getAllChannels();
		this.emitStatus(PubnubStatus.Connected, channels);
	}

	// emit a Trouble event, indicating we're having trouble subscribing to one or more
	// channels, so the client can display something to the user as needed
	private emitTrouble () {
		const channels = this.getUnsubscribedChannels();
		this.emitStatus(PubnubStatus.Trouble, channels);
	}

	// let the client know we were unable to subscribe to a given set of channels, and
	// moreover that we were unable to even get the server to give us access to those
	// channels ... something is wrong in this case and we'll no longer attempt to 
	// subscribe to those channels
	private emitFailures (channels: Array<string>) {
		this.emitStatus(PubnubStatus.SomeFailed, channels);
	}

	// get all known channels to which we are being asked to subscribe
	private getAllChannels () : Array<string> {
		return Object.keys(this._subscriptions);
	}

	// get all channels that we are actively subscribed to
	private getSubscribedChannels () : Array<string> {
		return Object.keys(this._subscriptions).filter(channel => {
			return this._subscriptions[channel].subscribed;
		});
	}

	// get all channels that we are not yet subscribed to
	private getUnsubscribedChannels () : Array<string> {
		return Object.keys(this._subscriptions).filter(channel => {
			return !this._subscriptions[channel].subscribed;
		});
	}

	// emit an Offline event, indicating we are currently not connected to the network
	private offline () {
		this.emitStatus(PubnubStatus.Offline);
	}

	// resubscribe to all channels
	private resubscribe () {
		Object.keys(this._subscriptions).forEach(channel => {
			this._subscriptions[channel].subscribed = false;
		});
		// also drain the queue and add any queued channels to the list, since we're 
		// starting from scratch on all of them anyway
		this.drainQueue();
	}

	// emit a Reset event, indicating to the client that we have too many messages to
	// fetch to catch up on messages, and that it would be better for the client to
	// initiate a fresh session ... in doing this, we'll unsubscribe to all channels,
	// since it is expected that the client will initiate new subscriptions after 
	// resetting the session
	private reset () {
		this.unsubscribeAll();
		this.emitStatus(PubnubStatus.Reset);
	}

	// remove the given set of channels from our list of channels to which we are
	// trying to subscribe
	private removeChannels (channels: Array<string>) {
		for (let channel of channels) {
			delete this._subscriptions[channel];
		}
	}

	// emit Pubnub messages to the client
	private emitMessages (messages: Array<any>) {
		this._messageEmitter.fire(messages);
	}

	// convert from unix timestamp to Pubnub time token
	private timestampToTimetoken (timestamp:number) : number {
		return timestamp * 10000;
	}

	// convert from Pubnub time token to unix timestamp
	private timetokenToTimestamp (timetoken:string) : number {
		return parseInt(timetoken, 10) / 10000;
	}
}
