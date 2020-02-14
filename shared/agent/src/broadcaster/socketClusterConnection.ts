// Provide the SocketClusterConnection class, which encapsulates communications with SocketCluster to receive
// messages in real-time
"use strict";

import { AGClientSocket, create } from "socketcluster-client";
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
	};
}

export class SocketClusterConnection implements BroadcasterConnection {
	private _subscriptions: SubscriptionMap = {};
	private _socket: AGClientSocket | undefined;
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
				this._socket = create({
					hostname: options.host,
					port: parseInt(options.port, 10),
					secure: true,
					autoReconnect: true
					// rejectUnauthorized: false
				});
			} catch (ex) {
				this._connectionPending = false;
				reject(ex);
			}

			(async () => {

				this._debug("Emitting authorization request to SocketCluster...");
				try {
					await this._socket!.invoke("auth", {
						token: options.authKey,
						uid: options.userId
					});
				}
				catch (error) {
					const message = error instanceof Error ? error.message : JSON.stringify(error);
					reject(`Auth error: ${message}`);
				}
				this._debug("SocketCluster authorized the connection");
				if (this._connectionTimer) {
					clearTimeout(this._connectionTimer);
				}
				this._connectionPending = false;

				(async () => {
					for await (
						const { channel } of this._socket!.listener("subscribe")
					) {
						this._handleSubscribe(channel);
					}
				})();

				(async () => {
					for await (const {error} of this._socket!.listener("error")) {
						this._debug("SOCKET ERROR: ", JSON.stringify(error));
						if (this._connectionPending) {
							reject(error);
						}
						else {
							this.netHiccup();
						}
					}
				})();

				resolve({
					dispose: this.disconnect.bind(this)
				});
			})();
		});
	}

	disconnect(): void {
		if (this._socket) {
			this.unsubscribeAll();
			this._socket!.killAllListeners();
			this._socket.disconnect();
		}
	}

	reconnect(): void {}

	private netHiccup() {
		if (this._statusCallback) {
			this._statusCallback({
				status: BroadcasterStatusType.NetworkProblem
			});
		}
	}

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
			if (!subscription) {
				troubleChannels.push(channel);
			}
		}
		return troubleChannels;
	}

	fetchHistory(options: BroadcasterHistoryInput): Promise<BroadcasterHistoryOutput> {
		return new SocketClusterHistory().fetchHistory({
			socket: this._socket!,
			...options
		});
	}

	_subscribeToChannel(channel: string) {

		(async () => {
			try {
				for await (
					const data of this._socket!.subscribe(channel)
				) {
					this._handleMessage(data);
				}
			}
			catch (error) {
				this._debug("SocketCluster failed to subscribe to", channel);
				this._handleSubscribeFail(error, channel);
			}
		})();
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
		if (subscription) {
			this._socket?.unsubscribe(channel);
		}
		delete this._subscriptions[channel];
	}

	unsubscribeAll() {
		for (const channel in this._subscriptions) {
			this._unsubscribeChannel(channel);
		}
	}
}
