"use strict";
import HttpsProxyAgent from "https-proxy-agent";
import { Disposable, Emitter, Event } from "vscode-languageserver";
import { Logger } from "../../logger";
import {
	ChannelDescriptor,
	Messager,
	MessagerStatus,
	MessagerStatusType
} from "../../messager/messager";
import { ConnectionStatus } from "../../protocol/agent.protocol";
import { log } from "../../system";
import { ConnectionRTMessage, MessageType, RawRTMessage } from "../apiProvider";
import { CodeStreamApiProvider } from "./codestreamApi";

const messageToType: {
	[key: string]:
		| MessageType.Codemarks
		| MessageType.MarkerLocations
		| MessageType.Markers
		| MessageType.Posts
		| MessageType.Repositories
		| MessageType.Streams
		| MessageType.Teams
		| MessageType.Users
		| undefined;
} = {
	codemark: MessageType.Codemarks,
	codemarks: MessageType.Codemarks,
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

export interface MessagerEventsInitializer {
	accessToken: string;
	messagerToken: string;
	api: CodeStreamApiProvider;
	pubnubSubscribeKey?: string;
	socketCluster?: {
		host: string,
		port: string
	};
	proxyAgent?: HttpsProxyAgent;
}

export class MessagerEvents implements Disposable {
	private _onDidReceiveMessage = new Emitter<RawRTMessage>();
	get onDidReceiveMessage(): Event<RawRTMessage> {
		return this._onDidReceiveMessage.event;
	}

	private _disposable: Disposable | undefined;
	private readonly _messager: Messager;
	private _subscribedStreamIds = new Set<string>();

	constructor (
		private readonly _options: MessagerEventsInitializer
	) {
		this._messager = new Messager(this._options.api, this._options.proxyAgent);
		this._messager.onDidStatusChange(this.onMessagerStatusChanged, this);
		this._messager.onDidReceiveMessages(this.onMessagerMessagesReceived, this);
	}

	@log()
	async connect(streamIds?: string[]): Promise<Disposable> {
		Logger.log("INITING MESSAGER...");
		this._disposable = await this._messager.initialize({
			accessToken: this._options.accessToken,
			pubnubSubscribeKey: this._options.pubnubSubscribeKey,
			socketCluster: this._options.socketCluster,
			authKey: this._options.messagerToken,
			userId: this._options.api.userId,
			debug: this.debug.bind(this),
			proxyAgent: this._options.proxyAgent
		});

		const channels: ChannelDescriptor[] = [
			{ name: `user-${this._options.api.userId}` },
			{ name: `team-${this._options.api.teamId}`, withPresence: true }
		];

		for (const streamId of streamIds || []) {
			channels.push({ name: `stream-${streamId}` });
			this._subscribedStreamIds.add(streamId);
		}

		this._messager.subscribe(channels);

		return this._disposable;
	}

	dispose() {
		if (this._disposable === undefined) return;

		this._disposable.dispose();
		this._disposable = undefined;
	}

	@log()
	subscribeToStream(streamId: string) {
		if (!this._subscribedStreamIds.has(streamId)) {
			this._messager.subscribe([`stream-${streamId}`]);
			this._subscribedStreamIds.add(streamId);
		}
	}

	@log()
	unsubscribeFromStream(streamId: string) {
		if (this._subscribedStreamIds.has(streamId)) {
			this._messager.unsubscribe([`stream-${streamId}`]);
			this._subscribedStreamIds.delete(streamId);
		}
	}

	private onMessagerStatusChanged(e: MessagerStatus) {
		this.debug("Connection status", e);
		switch (e.status) {
			case MessagerStatusType.Connected:
				if (e.reconnected) {
					this._onDidReceiveMessage.fire({
						type: MessageType.Connection,
						data: { reset: false, status: ConnectionStatus.Reconnected }
					} as ConnectionRTMessage);
				}
				break;

			case MessagerStatusType.Trouble:
				this._onDidReceiveMessage.fire({
					type: MessageType.Connection,
					data: { status: ConnectionStatus.Reconnecting }
				} as ConnectionRTMessage);
				break;

			case MessagerStatusType.Reset:
				// TODO: must fetch all data fetch from the server
				this._onDidReceiveMessage.fire({
					type: MessageType.Connection,
					data: { reset: true, status: ConnectionStatus.Reconnected }
				} as ConnectionRTMessage);
				break;

			case MessagerStatusType.Offline:
				this._onDidReceiveMessage.fire({
					type: MessageType.Connection,
					data: { status: ConnectionStatus.Disconnected }
				} as ConnectionRTMessage);
				break;

			case MessagerStatusType.Failed:
				// TODO: let the extension know we have trouble?
				// the indicated channels have not been subscribed to, what do we do?
				break;
		}
	}

	private onMessagerMessagesReceived(messages: { [key: string]: any }[]) {
		this.debug("Messager messages", messages);

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
					Logger.warn(`Unknown message type received from messager: ${dataType}`);
				}
			} catch (ex) {
				Logger.error(ex, `Messager '${dataType}' FAILED`);
			}
		}
	}

	private debug(msg: string, info?: any) {
		if (arguments.length === 1) {
			Logger.logWithDebugParams(`MESSAGER: ${msg}`);
		} else {
			Logger.logWithDebugParams(`MESSAGER: ${msg}`, info);
		}
	}
}
