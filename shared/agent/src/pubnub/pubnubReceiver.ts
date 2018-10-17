"use strict";
import { Disposable, Emitter, Event } from "vscode-languageserver";
import {
	ApiProvider,
	ConnectionRTMessage,
	ConnectionStatus,
	MessageType,
	RawRTMessage
} from "../api/apiProvider";
import { CodeStreamApiProvider } from "../api/codestream/codestreamApi";
import { Logger, TraceLevel } from "../logger";
import {
	ChannelDescriptor,
	PubnubConnection,
	PubnubStatus,
	StatusChangeEvent
} from "./pubnubConnection";

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

export class PubnubReceiver {
	private _onDidReceiveMessage = new Emitter<RawRTMessage>();
	get onDidReceiveMessage(): Event<RawRTMessage> {
		return this._onDidReceiveMessage.event;
	}

	private _subscribedStreamIds = new Set<string>();
	private readonly _pubnubConnection: PubnubConnection;
	private _connection: Disposable | undefined;

	constructor(
		api: ApiProvider,
		pubnubKey: string,
		pubnubToken: string,
		accessToken: string,
		private readonly _userId: string,
		private readonly _teamId: string
	) {
		this._pubnubConnection = new PubnubConnection();
		this._connection = this._pubnubConnection.initialize({
			api: api,
			accessToken: accessToken,
			subscribeKey: pubnubKey,
			authKey: pubnubToken,
			userId: _userId,
			online: true,
			debug: this.debug.bind(this)
		});

		this._pubnubConnection.onDidStatusChange(this.onPubnubStatusChanged, this);
		this._pubnubConnection.onDidReceiveMessages(this.onPubNubMessagesReceived, this);
	}

	listen(streamIds?: string[]): Disposable {
		const channels: ChannelDescriptor[] = [
			{ name: `user-${this._userId}` },
			{ name: `team-${this._teamId}`, withPresence: true }
		];

		for (const streamId of streamIds || []) {
			channels.push({ name: `stream-${streamId}` });
			this._subscribedStreamIds.add(streamId);
		}

		this._pubnubConnection.subscribe(channels);

		return {
			dispose: () => {
				this._connection!.dispose();
			}
		};
	}

	subscribeToStream(streamId: string) {
		if (!this._subscribedStreamIds.has(streamId)) {
			this._pubnubConnection.subscribe([`stream-${streamId}`]);
			this._subscribedStreamIds.add(streamId);
		}
	}

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

	private onPubNubMessagesReceived(messages: { [key: string]: any }[]) {
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
