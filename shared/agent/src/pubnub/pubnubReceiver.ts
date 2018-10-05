"use strict";
import { Disposable, Emitter, Event } from "vscode-languageserver";
import { CodeStreamAgent } from "../agent";
import { CodeStreamApi } from "../api/api";
import { Logger, TraceLevel } from "../logger";
import { CodeStreamRTEMessage, MessageSource } from "../managers/realTimeMessage";
import { MessageType } from "../shared/agent.protocol";
import {
	ChannelDescriptor,
	PubnubConnection,
	PubnubStatus,
	StatusChangeEvent
} from "./pubnubConnection";

const messageType = {
	post: MessageType.Posts,
	repo: MessageType.Repositories,
	stream: MessageType.Streams,
	user: MessageType.Users,
	team: MessageType.Teams,
	marker: MessageType.Markers,
	markerLocations: MessageType.MarkerLocations
};

export class PubnubReceiver {
	private _onDidReceiveMessage = new Emitter<CodeStreamRTEMessage>();
	get onDidReceiveMessage(): Event<CodeStreamRTEMessage> {
		return this._onDidReceiveMessage.event;
	}

	private readonly _pubnubConnection: PubnubConnection;
	private _connection: Disposable | undefined;

	constructor(
		private _agent: CodeStreamAgent,
		private readonly _api: CodeStreamApi,
		pubnubKey: string,
		pubnubToken: string,
		private readonly _accessToken: string,
		private readonly _userId: string,
		private readonly _teamId: string
	) {
		this._pubnubConnection = new PubnubConnection();
		this._connection = this._pubnubConnection.initialize({
			api: _api,
			accessToken: _accessToken,
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
			this.processMessage(message);
		}
	}

	private processMessage(message: { [key: string]: any }) {
		const { requestId, ...messages } = message;
		requestId;

		for (const [key, obj] of Object.entries(messages)) {
			try {
				const changeSets = Array.isArray(obj) ? obj : [obj];
				const type = (messageType as any)[key];
				if (type) {
					this._onDidReceiveMessage.fire({
						source: MessageSource.CodeStream,
						type,
						changeSets
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
