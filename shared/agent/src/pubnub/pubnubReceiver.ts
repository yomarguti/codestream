"use strict";
import { Disposable, Emitter, Event } from "vscode-languageserver";
import { ApiProvider, RTMessage } from "../api/apiProvider";
import { CodeStreamApiProvider } from "../api/codestreamApi";
import { Logger, TraceLevel } from "../logger";
import { MessageType } from "../shared/agent.protocol";
import {
	ChannelDescriptor,
	PubnubConnection,
	PubnubStatus,
	StatusChangeEvent
} from "./pubnubConnection";

const messageToType: { [key: string]: MessageType | undefined } = {
	post: MessageType.Posts,
	posts: MessageType.Posts,
	repo: MessageType.Repositories,
	repos: MessageType.Repositories,
	stream: MessageType.Streams,
	streams: MessageType.Streams,
	user: MessageType.Users,
	users: MessageType.Users,
	team: MessageType.Teams,
	teams: MessageType.Teams,
	marker: MessageType.Markers,
	markers: MessageType.Markers,
	markerLocations: MessageType.MarkerLocations
};

export class PubnubReceiver {
	private _onDidReceiveMessage = new Emitter<RTMessage>();
	get onDidReceiveMessage(): Event<RTMessage> {
		return this._onDidReceiveMessage.event;
	}

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
		}

		this._pubnubConnection.subscribe(channels);

		return {
			dispose: () => {
				this._connection!.dispose();
			}
		};
	}

	private onPubnubStatusChanged(e: StatusChangeEvent) {
		this.debug("Connection status", e);
		switch (e.status) {
			case PubnubStatus.Connected:
				// TODO: let the extension know we are connected?
				break;

			case PubnubStatus.Trouble:
				// TODO: let the extension know we have trouble?
				break;

			case PubnubStatus.Reset:
				// TODO: must fetch all data fetch from the server
				break;

			case PubnubStatus.Offline:
				// TODO: let the extension know we are offline?
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

		for (const [key, obj] of Object.entries(messages)) {
			try {
				const changes = CodeStreamApiProvider.normalizeResponse<any>(obj);
				const data = Array.isArray(changes) ? changes : [changes];
				const type = messageToType[key];
				if (type) {
					this._onDidReceiveMessage.fire({
						type: type,
						data: data
					});
				} else {
					Logger.warn(`Unknown message type received from PubNub: ${key}`);
				}
			} catch (ex) {
				Logger.error(ex, `PubNub '${key}' FAILED`);
			}
		}
	}

	private debug(msg: string, info?: any) {
		if (Logger.level !== TraceLevel.Debug && !Logger.isDebugging) return;

		Logger.log(`PUBNUB: ${msg}${info ? `: ${JSON.stringify(info, undefined, 10)}` : ""}`);
	}
}
