"use strict";
import { Disposable, Emitter, Event } from "vscode-languageserver";
import { CodeStreamAgent } from "../agent";
import { DidReceivePubNubMessagesNotification } from "../agent";
import {
	CodeStreamApi,
	CSMarker,
	CSMarkerLocations,
	CSPost,
	CSRepository,
	CSStream,
	CSTeam,
	CSUser
} from "../api/api";
import { Logger, TraceLevel } from "../logger";
import { Iterables } from "../system";
import {
	ChannelDescriptor,
	PubnubConnection,
	PubnubStatus,
	StatusChangeEvent
} from "./pubnubConnection";

export enum MessageType {
	Posts = "posts",
	Repositories = "repos",
	Streams = "streams",
	Users = "users",
	Teams = "teams",
	Markers = "markers",
	MarkerLocations = "markerLocations"
}

export interface PostsMessageReceivedEvent {
	type: MessageType.Posts;
	changeSets: object[];
}

export interface RepositoriesMessageReceivedEvent {
	type: MessageType.Repositories;
	repos: CSRepository[];
}

export interface StreamsMessageReceivedEvent {
	type: MessageType.Streams;
	streams: CSStream[];
}

export interface UsersMessageReceivedEvent {
	type: MessageType.Users;
	users: CSUser[];
}

export interface TeamsMessageReceivedEvent {
	type: MessageType.Teams;
	teams: CSTeam[];
}

export interface MarkersMessageReceivedEvent {
	type: MessageType.Markers;
	markers: CSMarker[];
}

export interface MarkerLocationsMessageReceivedEvent {
	type: MessageType.MarkerLocations;
	markerLocations: CSMarkerLocations;
}

export type MessageReceivedEvent =
	| PostsMessageReceivedEvent
	| RepositoriesMessageReceivedEvent
	| StreamsMessageReceivedEvent
	| UsersMessageReceivedEvent
	| MarkersMessageReceivedEvent
	| MarkerLocationsMessageReceivedEvent
	| TeamsMessageReceivedEvent;

export class PubnubReceiver {
	private _onDidReceiveMessage = new Emitter<MessageReceivedEvent>();
	get onDidReceiveMessage(): Event<MessageReceivedEvent> {
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
		this._agent.sendNotification(DidReceivePubNubMessagesNotification, messages);

		for (const message of messages) {
			this.processMessage(message);
		}
	}

	private async processMessage(message: { [key: string]: any }) {
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
					case "posts":
						this._onDidReceiveMessage.fire({
							type: MessageType.Posts,
							changeSets: obj
						});
						break;
					case "repos":
						// TODO: Need to deal with directives or just fire events with ids or entities
						let repos;
						entities = this.stripDirectives(key, entities);
						if (entities && entities.length) {
							repos = CodeStreamApi.normalizeResponse(entities) as CSRepository[];
						}
						this._onDidReceiveMessage.fire({ type: MessageType.Repositories, repos: repos || [] });
						break;
					case "streams":
						entities = await this.processDirectives(
							key,
							entities,
							async id => (await this._api.getStream(this._accessToken, this._teamId, id)).stream
						);
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
						this._onDidReceiveMessage.fire({ type: MessageType.Streams, streams });
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
					case "markers": {
						const markers = CodeStreamApi.normalizeResponse(entities) as CSMarker[];
						this._onDidReceiveMessage.fire({ type: MessageType.Markers, markers });
						break;
					}
					case "markerLocations": {
						const markerLocations = CodeStreamApi.normalizeResponse(entities) as CSMarkerLocations;
						this._onDidReceiveMessage.fire({ type: MessageType.MarkerLocations, markerLocations });
						break;
					}
				}
			} catch (ex) {
				Logger.error(ex, `PubNub '${key}' FAILED`);
			}
		}
	}

	private async processDirectives(
		key: string,
		entities: any[] | undefined,
		fetch: (id: string) => Promise<any>
	): Promise<any[] | undefined> {
		if (!entities || !entities.length) return entities;

		const fetched = await Promise.all(
			entities.map(async e => {
				if (Object.keys(e).some(k => k.startsWith("$"))) {
					try {
						return await fetch(e._id);
					} catch {
						return undefined;
					}
				}
				return e;
			})
		);
		return fetched.filter(e => e !== undefined);
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

	private debug(msg: string, info?: any) {
		if (Logger.level !== TraceLevel.Debug && !Logger.isDebugging) return;

		Logger.log(`PUBNUB: ${msg}${info ? `: ${JSON.stringify(info, undefined, 10)}` : ""}`);
	}
}
