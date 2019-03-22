// Provide the SocketClusterConnection class, which encapsulates communications with SocketCluster to receive
// messages in real-time
"use strict";
import { SCChannel } from "sc-channel";
import { create, SCClientSocket } from "socketcluster-client";
import { Disposable } from "vscode-languageserver";
import {
	MessageCallback,
	MessageEvent,
	MessagerConnection,
	MessagerConnectionOptions,
	MessagerHistoryInput,
	MessagerHistoryOutput,
	MessagerStatusType,
	StatusCallback
} from "./messager";
import { SocketClusterHistory } from "./socketClusterHistory";

// use this interface to initialize the SocketClusterConnection class
export interface SocketClusterInitializer {
	host: string;	// host of the socketcluster server
	port: string;	// port of the socketcluster server
	authKey: string; // unique token provided in the login response
	userId: string; // ID of the current user
	debug?(msg: string, info?: any): void; // for debug messages
	onMessage: MessageCallback;
	onStatus: StatusCallback;
}

// internal, maintains map of channels and whether they are yet successfully subscribed
interface SubscriptionMap {
	[key: string]: {
		subscribed: boolean;
		withPresence?: boolean;
		scChannel?: SCChannel;
	};
}

interface SocketClusterBatchHistoryRequest {
	requestId: string;
	channels: string[];
	since: number;
}

export class SocketClusterConnection implements MessagerConnection {
	private _connected: boolean = false;
	private _subscriptions: SubscriptionMap = {};
	private _scClient: SCClientSocket | undefined;
	private _debug: (msg: string, info?: any) => void = () => {};
	private _messageCallback: MessageCallback | undefined;
	private _statusCallback: StatusCallback | undefined;

	// initialize SocketCluster connection
	initialize(options: SocketClusterInitializer): Promise<Disposable> {

		if (options.debug) {
			this._debug = options.debug;
		}
		this._debug(`SocketCluster Connection initializing...`);

		this._messageCallback = options.onMessage;
		this._statusCallback = options.onStatus;

		return new Promise((resolve, reject) => {

			try {
				this._scClient = create({
					hostname: options.host,
					port: parseInt(options.port, 10),
					secure: true,
					rejectUnauthorized: false
				});
			}
			catch (ex) {
console.warn('REJECTING CLIENT DUE TO EXECEPTION');
				reject(ex);
			}
			this._scClient!.on("connect", () => {
				this._onConnected(options);
			});

			this._scClient!.on("disconnect", () => {
				this._onDisconnect(options);
			});

			this._scClient!.on("authed", () => {
				resolve({
					dispose: () => {
						this.unsubscribeAll();
						this._scClient!.disconnect();
					}
				});
			});
			this._scClient!.on("error", error => {
				if (!this._connected) {
console.warn('REJECTING CONNECTION', error);
					reject(error);
				}
				const message = error instanceof Error ? error.message : JSON.stringify(error);
				this._debug(`SOCKET ERROR: ${message}`);
			});
		});
	}

	_onConnected(options: SocketClusterInitializer): void {
console.warn('SOCKET BECAME CONNECTED!');
		this._connected = true;
		this._scClient!.emit("auth", {
			token: options.authKey,
			uid: options.userId
		});
	}

	_onDisconnect(options: SocketClusterInitializer): void {
console.warn('SOCKET BECAME DISCONNECTED');
		if (this._statusCallback) {
			this._statusCallback({
				status: MessagerStatusType.NetworkProblem
			});
		}
	}

	disconnect(): void {
		if (this._scClient) {
			this._scClient.disconnect();
		}
	}

	reconnect(): void {
	}

	subscribe(channels: string[], options: MessagerConnectionOptions = {}) {
		this._debug('SocketCluster request to subscribe:', channels);
		const unsubscribedChannels: string[] = [];
		const subscribedChannels: string[] = [];
		for (const channel of channels) {
console.warn('channel is subscribed?', channel);
			const subscription = this._subscriptions[channel] || {
				subscribed: false,
				withPresence: !!options.withPresence
			};
			this._subscriptions[channel] = subscription;
			if (subscription.subscribed) {
console.warn('yah');
				subscribedChannels.push(channel);
			} else {
console.warn('nay');
				unsubscribedChannels.push(channel);
			}
		}
		if (subscribedChannels.length > 0 && this._statusCallback) {
			this._debug('SocketCluster already subscribed to ', subscribedChannels);
console.warn('we are already subscribed to ', subscribedChannels);
			this._statusCallback({
				status: MessagerStatusType.Connected,
				channels: subscribedChannels
			});
		}
		if (unsubscribedChannels.length > 0) {
			this._debug('SocketCluster not yet subscribed, will subscribe now to', unsubscribedChannels);
console.warn('we are not subscribed to ', unsubscribedChannels);
			for (const channel of unsubscribedChannels) {
				this._subscribeToChannel(channel);
			}
		}
	}

	async confirmSubscriptions(channels: string[]): Promise<string[]> {
		const troubleChannels = [];
		for (const channel of channels) {
			const subscription = this._subscriptions[channel];
			if (
				!subscription ||
				!subscription.scChannel ||
				!subscription.scChannel.isSubscribed()
			) {
				troubleChannels.push(channel);
			}
		}
console.warn('TROUBLE CHANNELS ARE', troubleChannels);
		return troubleChannels;
	}

	fetchHistory (options: MessagerHistoryInput): Promise<MessagerHistoryOutput> {
		return new SocketClusterHistory().fetchHistory({
			scClient: this._scClient!,
			...options
		});
	}

	_subscribeToChannel(channel: string) {
		const subscription = this._subscriptions[channel];
console.warn('really subscribing to ', channel);
		const scChannel = subscription.scChannel = this._scClient!.subscribe(channel);
		scChannel.watch(this._handleMessage.bind(this));
		scChannel.on("subscribe", () => {
console.warn('and we are now subscribed to ', channel);
			this._debug('SocketCluster successfully subscribed to', channel);
			this._handleSubscribe(channel);
		});
		scChannel.on("subscribeFail", (error: any) => {
console.warn('failed to subscribe to ' + channel);
			this._debug('SocketCluster failed to subscribe to', channel);
			this._handleSubscribeFail(error, channel);
		});
	}

	// handle a message coming in on any channel
	_handleMessage (message: any) {
		const receivedAt = Date.now();
		this._debug("SocketCluster message received at", receivedAt);
		const messageEvent: MessageEvent = {
			receivedAt,
			message
		};
		if (this._messageCallback) {
			this._messageCallback(messageEvent);
		}
	}

	_handleSubscribe(channel: string) {
		if (this._statusCallback) {
console.warn('YAH, WE ARE SUBSCRIBED TO', channel);
			this._statusCallback({
				status: MessagerStatusType.Connected,
				channels: [channel]
			});
		}
	}

	_handleSubscribeFail(error: any, channel: string) {
		if (this._statusCallback) {
			this._statusCallback({
				status: MessagerStatusType.Failed,
				channels: [channel]
			});
		}
	}

	// unsubscribe to the passed channels
	unsubscribe(channels: string[]) {
		for (const channel in channels) {
			this._unsubscribeChannel(channel);
		}
	}

	_unsubscribeChannel(channel: string) {
		const subscription = this._subscriptions[channel];
		if (subscription && subscription.scChannel) {
			subscription.scChannel.unsubscribe();
		}
		delete this._subscriptions[channel];
	}

	unsubscribeAll() {
		for (const channel in this._subscriptions) {
			this._unsubscribeChannel(channel);
		}
	}
}
