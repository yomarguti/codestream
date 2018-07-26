"use strict";
import { Disposable } from "vscode-languageserver";
import { CodeStreamAgent } from "../agent";
import { CodeStreamApi, CSStream } from "../api/api";
import { DidReceivePubNubMessagesNotification } from "../ipc/agent";
import { Logger } from "../logger";
import { Iterables } from "../system";
import {
	ChannelDescriptor,
	PubnubConnection,
	PubnubStatus,
	StatusChangeEvent
} from "./pubnubConnection";

export class PubnubReceiver {
	private readonly _pubnubConnection: PubnubConnection;
	private _connection: Disposable | undefined;

	constructor(
		private _agent: CodeStreamAgent,
		api: CodeStreamApi,
		pubnubKey: string,
		pubnubToken: string,
		accessToken: string,
		private readonly _userId: string,
		private readonly _teamId: string
	) {
		this._pubnubConnection = new PubnubConnection();
		this._connection = this._pubnubConnection.initialize({
			api,
			accessToken,
			subscribeKey: pubnubKey,
			authKey: pubnubToken,
			userId: _userId,
			online: true
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
		this._agent.sendNotification(DidReceivePubNubMessagesNotification.type, messages);

		for (const message of messages) {
			this.processMessage(message);
		}
	}

	private processMessage(message: { [key: string]: any }) {
		const { requestId, ...messages } = message;
		requestId;

		for (let [key, obj] of Object.entries(messages)) {
			let entities;
			try {
				switch (key) {
					case "post":
					case "repo":
					case "user":
					case "team":
					case "marker":
					case "stream":
						key += "s";
						entities = [obj];
						break;
					// case "markerLocations"
					default:
						entities = obj;
						break;
				}

				switch (key) {
					// 	case "posts":
					// 		const posts = (await this._cache.resolvePosts(entities)) as CSPost[];
					// 		this._onDidReceiveMessage.fire({
					// 			type: MessageType.Posts,
					// 			posts
					// 		});
					// 		break;
					// 	case "repos":
					// 		const repos = (await this._cache.resolveRepos(entities)) as CSRepository[];

					// 		this._onDidReceiveMessage.fire({
					// 			type: MessageType.Repositories,
					// 			repos
					// 		});
					// 		break;
					case "streams":
						// TODO: Needs fixing
						entities = this.stripDirectives(key, entities);
						if (!entities || !entities.length) continue;

						const streams = CodeStreamApi.normalizeResponse(entities) as CSStream[];
						// Subscribe to any new non-file, non-team streams
						this._pubnubConnection.subscribe([
							...Iterables.filterMap(
								streams,
								s =>
									CodeStreamApi.isStreamSubscriptionRequired(s, this._userId!)
										? `stream-${s.id}`
										: undefined
							)
						]);
						break;
					// case "users": {
					// 	const users = (await this._cache.resolveUsers(entities)) as CSUser[];
					// 	this._onDidReceiveMessage.fire({ type: MessageType.Users, users });
					// 	break;
					// }
					// case "teams": {
					// 	const teams = (await this._cache.resolveTeams(entities)) as CSTeam[];
					// 	this._onDidReceiveMessage.fire({ type: MessageType.Teams, teams });
					// 	break;
					// }
					// case "markers": {
					// 	const markers = (await this._cache.resolveMarkers(entities)) as CSMarker[];
					// 	this._onDidReceiveMessage.fire({ type: MessageType.Markers, markers });
					// 	break;
					// }
				}
			} catch (ex) {
				Logger.error(ex, `PubNub '${key}' FAILED`);
			}
		}
	}

	private stripDirectives(key: string, entities: any[] | undefined) {
		if (!entities || !entities.length) return entities;

		return entities.filter(e => {
			if (Object.keys(e).some(k => k.startsWith("$"))) {
				Logger.log(`PubNub '${key}' message with directive skipped\n${JSON.stringify(e)}`);
				return false;
			}
			return true;
		});
	}
}
