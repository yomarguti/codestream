"use strict";
import HttpsProxyAgent from "https-proxy-agent";
import { Disposable, Emitter, Event } from "vscode-languageserver";
import { Logger } from "../../logger";
import {
	ChannelDescriptor,
	PubnubConnection,
	PubnubStatus,
	StatusChangeEvent
} from "../../pubnub/pubnubConnection";
import { log } from "../../system";
import { ConnectionRTMessage, ConnectionStatus, MessageType, RawRTMessage } from "../apiProvider";
import { CodeStreamApiProvider } from "./codestreamApi";

const messageToType: {
	[key: string]:
		| MessageType.MarkerLocations
		| MessageType.Markers
		| MessageType.Posts
		| MessageType.Repositories
		| MessageType.Streams
		| MessageType.Teams
		| MessageType.Users
		| undefined;
} = {
	marker: MessageType.Markers,
	markerLocations: MessageType.MarkerLocations,
	markers: MessageType.Markers,
	post: MessageType.Posts,
	posts: MessageType.Posts,
	repo: MessageType.Repositories,
	repos: MessageType.Repositories,
	stream: MessageType.Streams,
	streams: MessageType.Streams,
	team: MessageType.Teams,
	teams: MessageType.Teams,
	user: MessageType.Users,
	users: MessageType.Users
};

export class PubnubEvents {
	private _onDidReceiveMessage = new Emitter<RawRTMessage>();
	get onDidReceiveMessage(): Event<RawRTMessage> {
		return this._onDidReceiveMessage.event;
	}

	private _disposable: Disposable | undefined;
	private readonly _pubnubConnection: PubnubConnection;
	private _subscribedStreamIds = new Set<string>();

	constructor(
		private readonly _accessToken: string,
		private readonly _pubnubKey: string,
		private readonly _pubnubToken: string,
		private readonly _api: CodeStreamApiProvider,
		proxyAgent: HttpsProxyAgent | undefined
	) {
		this._pubnubConnection = new PubnubConnection(_api, proxyAgent);
		this._pubnubConnection.onDidStatusChange(this.onPubnubStatusChanged, this);
		this._pubnubConnection.onDidReceiveMessages(this.onPubnubMessagesReceived, this);
	}

	get connected() {
		return this._pubnubConnection.online;
	}

	@log()
	connect(streamIds?: string[]): Disposable {
		this._disposable = this._pubnubConnection.initialize({
			accessToken: this._accessToken,
			subscribeKey: this._pubnubKey,
			authKey: this._pubnubToken,
			userId: this._api.userId,
			online: true,
			debug: this.debug.bind(this)
		});

		const channels: ChannelDescriptor[] = [
			{ name: `user-${this._api.userId}` },
			{ name: `team-${this._api.teamId}`, withPresence: true }
		];

		for (const streamId of streamIds || []) {
			channels.push({ name: `stream-${streamId}` });
			this._subscribedStreamIds.add(streamId);
		}

		this._pubnubConnection.subscribe(channels);

		return this._disposable;
	}

	@log()
	disconnect() {
		if (this._disposable === undefined) return;

		this._disposable.dispose();
		this._disposable = undefined;
	}

	@log()
	subscribeToStream(streamId: string) {
		if (!this._subscribedStreamIds.has(streamId)) {
			this._pubnubConnection.subscribe([`stream-${streamId}`]);
			this._subscribedStreamIds.add(streamId);
		}
	}

	@log()
	unsubscribeFromStream(streamId: string) {
		if (this._subscribedStreamIds.has(streamId)) {
			this._pubnubConnection.unsubscribe([`stream-${streamId}`]);
			this._subscribedStreamIds.delete(streamId);
		}
	}

	private onPubnubStatusChanged(e: StatusChangeEvent) {
		this.debug("Connection status", e);
		switch (e.status) {
			case PubnubStatus.Connected:
				if (e.reconnected) {
					this._onDidReceiveMessage.fire({
						type: MessageType.Connection,
						data: { status: ConnectionStatus.Reconnected }
					} as ConnectionRTMessage);
				}
				break;

			case PubnubStatus.Trouble:
				this._onDidReceiveMessage.fire({
					type: MessageType.Connection,
					data: { status: ConnectionStatus.Reconnecting }
				} as ConnectionRTMessage);
				break;

			case PubnubStatus.Reset:
				// TODO: must fetch all data fetch from the server
				break;

			case PubnubStatus.Offline:
				this._onDidReceiveMessage.fire({
					type: MessageType.Connection,
					data: { status: ConnectionStatus.Disconnected }
				} as ConnectionRTMessage);
				break;

			case PubnubStatus.Failed:
				// TODO: let the extension know we have trouble?
				// the indicated channels have not been subscribed to, what do we do?
				break;
		}
	}

	private onPubnubMessagesReceived(messages: { [key: string]: any }[]) {
		this.debug("PubNub messages", messages);

		for (const message of messages) {
			this.fireMessage(message);
		}
	}

	private fireMessage(message: { [key: string]: any }) {
		const { requestId, messageId, ...messages } = message;

		for (const [dataType, rawData] of Object.entries(messages)) {
			try {
				const type = messageToType[dataType];
				if (type) {
					const data = CodeStreamApiProvider.normalizeResponse<any>(rawData);
					this._onDidReceiveMessage.fire({
						type: type,
						data: Array.isArray(data) ? data : [data]
					});
				} else {
					Logger.warn(`Unknown message type received from PubNub: ${dataType}`);
				}
			} catch (ex) {
				Logger.error(ex, `PubNub '${dataType}' FAILED`);
			}
		}
	}

	private debug(msg: string, info?: any) {
		if (arguments.length === 1) {
			Logger.logWithDebugParams(`PUBNUB: ${msg}`);
		} else {
			Logger.logWithDebugParams(`PUBNUB: ${msg}`, info);
		}
	}
}
