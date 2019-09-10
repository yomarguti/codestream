// Provide the SocketClusterConnection class, which encapsulates communications with SocketCluster to receive
// messages in real-time
"use strict";
import { SCChannel } from "sc-channel";
import { create, SCClientSocket } from "socketcluster-client";
import { Disposable } from "vscode-languageserver";
import {
	BroadcasterConnection,
	BroadcasterConnectionOptions,
	BroadcasterHistoryInput,
	BroadcasterHistoryOutput,
	BroadcasterStatusType,
	MessageCallback,
	MessageEvent,
	StatusCallback
} from "./broadcaster";
import { SocketClusterHistory } from "./socketClusterHistory";

// use this interface to initialize the SocketClusterConnection class
export interface SocketClusterInitializer {
	host: string; // host of the socketcluster server
	port: string; // port of the socketcluster server
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

export class SocketClusterConnection implements BroadcasterConnection {
	private _connected: boolean = false;
	private _subscriptions: SubscriptionMap = {};
	private _scClient: SCClientSocket | undefined;
	private _debug: (msg: string, info?: any) => void = () => {};
	private _messageCallback: MessageCallback | undefined;
	private _statusCallback: StatusCallback | undefined;
	private _connectionTimer: NodeJS.Timer | undefined;
	private _connectionPending: boolean = false;

	// initialize SocketCluster connection
	initialize(options: SocketClusterInitializer): Promise<Disposable> {
		if (options.debug) {
			this._debug = options.debug;
		}
		this._debug("SocketCluster Connection initializing...");

		this._messageCallback = options.onMessage;
		this._statusCallback = options.onStatus;

		this._connectionPending = true;
		return new Promise((resolve, reject) => {
			this._connectionTimer = setTimeout(() => {
				this._debug("SocketCluster connection timed out");
				this._connectionPending = false;
				reject("timed out");
			}, 10000);
			try {
				this._debug("Creating SocketCluster connection...");
				this._scClient = create({
					hostname: options.host,
					port: parseInt(options.port, 10),
					secure: true,
					rejectUnauthorized: false
				});
			} catch (ex) {
				this._connectionPending = false;
				reject(ex);
			}

			this._scClient!.on("connect", () => {
				this._debug("SocketCluster connected");
				if (this._connectionPending) {
					this._onConnected(options);
				}
			});

			this._scClient!.on("disconnect", () => {
				this._debug("SocketCluster disconnected");
				this._onDisconnect(options);
			});

			/*

			For some reason, the SocketCluster client is not always receiving
			our "authed" event after the user is authorized, but SocketCluster
			seems to have another event for this purpose ... this event may be
			internal and maybe we shouldn't rely on it, but I can't figure out
			any other way to ensure user authorization if our emitted event isn't
			being received

			this._scClient!.on("authed", () => {
				this._debug("SocketCluster authorized the connection");
				if (this._connectionTimer) {
					clearTimeout(this._connectionTimer);
				}
				this._connectionPending = false;
				resolve({
					dispose: () => {
						this.unsubscribeAll();
						this._scClient!.disconnect();
					}
				});
			});
			*/

			this._scClient!.on("message", (msg: string) => {
				this._debug("Received SocketCluster message", msg);
				let data: { event?: string } = {};
				try {
					data = JSON.parse(msg);
				} catch (ex) {}
				if (data.event === "#setAuthToken") {
					// this._debug("Received SocketCluster authorization, but ignoring");
					this._debug("SocketCluster authorized the connection");
					if (this._connectionTimer) {
						clearTimeout(this._connectionTimer);
					}
					this._connectionPending = false;
					resolve({
						dispose: () => {
							this.unsubscribeAll();
							this._scClient!.disconnect();
						}
					});
				}
			});

			this._scClient!.on("error", error => {
				if (!this._connected) {
					this._connectionPending = false;
					reject(error);
				}
				const message = error instanceof Error ? error.message : JSON.stringify(error);
				this._debug(`SOCKET ERROR: ${message}`);
			});
		});
	}

	_onConnected(options: SocketClusterInitializer): void {
		this._connected = true;
		this._debug("Emitting authorization request to SocketCluster...");
		this._scClient!.emit("auth", {
			token: options.authKey,
			uid: options.userId
		});
	}

	_onDisconnect(options: SocketClusterInitializer): void {
		if (this._statusCallback) {
			this._statusCallback({
				status: BroadcasterStatusType.NetworkProblem
			});
		}
	}

	disconnect(): void {
		if (this._scClient) {
			this._scClient.disconnect();
		}
	}

	reconnect(): void {}

	subscribe(channels: string[], options: BroadcasterConnectionOptions = {}) {
		this._debug("SocketCluster request to subscribe:", channels);
		const unsubscribedChannels: string[] = [];
		const subscribedChannels: string[] = [];
		for (const channel of channels) {
			const subscription = this._subscriptions[channel] || {
				subscribed: false,
				withPresence: !!options.withPresence
			};
			this._subscriptions[channel] = subscription;
			if (subscription.subscribed) {
				subscribedChannels.push(channel);
			} else {
				unsubscribedChannels.push(channel);
			}
		}
		if (subscribedChannels.length > 0 && this._statusCallback) {
			this._debug("SocketCluster already subscribed to ", subscribedChannels);
			this._statusCallback({
				status: BroadcasterStatusType.Connected,
				channels: subscribedChannels
			});
		}
		if (unsubscribedChannels.length > 0) {
			this._debug("SocketCluster not yet subscribed, will subscribe now to", unsubscribedChannels);
			for (const channel of unsubscribedChannels) {
				this._subscribeToChannel(channel);
			}
		}
	}

	async confirmSubscriptions(channels: string[]): Promise<string[]> {
		const troubleChannels = [];
		for (const channel of channels) {
			const subscription = this._subscriptions[channel];
			if (!subscription || !subscription.scChannel || !subscription.scChannel.isSubscribed()) {
				troubleChannels.push(channel);
			}
		}
		return troubleChannels;
	}

	fetchHistory(options: BroadcasterHistoryInput): Promise<BroadcasterHistoryOutput> {
		return new SocketClusterHistory().fetchHistory({
			scClient: this._scClient!,
			...options
		});
	}

	_subscribeToChannel(channel: string) {
		const subscription = this._subscriptions[channel];
		const scChannel = (subscription.scChannel = this._scClient!.subscribe(channel));
		scChannel.watch(this._handleMessage.bind(this));
		scChannel.on("subscribe", () => {
			this._debug("SocketCluster successfully subscribed to", channel);
			this._handleSubscribe(channel);
		});
		scChannel.on("subscribeFail", (error: any) => {
			this._debug("SocketCluster failed to subscribe to", channel);
			this._handleSubscribeFail(error, channel);
		});
	}

	// handle a message coming in on any channel
	_handleMessage(message: any) {
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
			this._statusCallback({
				status: BroadcasterStatusType.Connected,
				channels: [channel]
			});
		}
	}

	_handleSubscribeFail(error: any, channel: string) {
		if (this._statusCallback) {
			this._statusCallback({
				status: BroadcasterStatusType.Failed,
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
