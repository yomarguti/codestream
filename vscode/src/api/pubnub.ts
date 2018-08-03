"use strict";
import { Disposable, Event, EventEmitter } from "vscode";
import { Container } from "../container";
import { Logger } from "../logger";
import { CSMarker, CSPost, CSRepository, CSStream, CSTeam, CSUser } from "./api";
import { Cache } from "./cache";

export enum MessageType {
	Posts = "posts",
	Repositories = "repos",
	Streams = "streams",
	Users = "users",
	Teams = "teams",
	Markers = "markers"
}

export interface PostsMessageReceivedEvent {
	type: MessageType.Posts;
	posts: CSPost[];
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

export type MessageReceivedEvent =
	| PostsMessageReceivedEvent
	| RepositoriesMessageReceivedEvent
	| StreamsMessageReceivedEvent
	| UsersMessageReceivedEvent
	| MarkersMessageReceivedEvent
	| TeamsMessageReceivedEvent;

export class PubNubReceiver implements Disposable {
	private _onDidReceiveMessage = new EventEmitter<MessageReceivedEvent>();
	get onDidReceiveMessage(): Event<MessageReceivedEvent> {
		return this._onDidReceiveMessage.event;
	}

	private _cache: Cache;
	private _disposable: Disposable;

	constructor(cache: Cache) {
		this._cache = cache;

		this._disposable = Disposable.from(
			Container.agent.onDidReceivePubNubMessages(this.onPubNubMessagesReceived, this)
		);
	}

	dispose() {
		this._disposable.dispose();
	}

	private async onPubNubMessagesReceived(messages: { [key: string]: any }[]) {
		for (const message of messages) {
			await this.processMessage(message);
		}
	}

	async processMessage(message: { [key: string]: any }) {
		const { requestId, ...messages } = message;
		requestId;

		for (let [key, obj] of Object.entries(messages)) {
			Logger.log(`PubNub '${key}' message received\n${JSON.stringify(obj)}`);

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

				switch (key as MessageType) {
					case "posts":
						const posts = (await this._cache.resolvePosts(entities)) as CSPost[];
						this._onDidReceiveMessage.fire({
							type: MessageType.Posts,
							posts
						});
						break;
					case "repos":
						const repos = (await this._cache.resolveRepos(entities)) as CSRepository[];

						this._onDidReceiveMessage.fire({
							type: MessageType.Repositories,
							repos
						});
						break;
					case "streams":
						const streams = (await this._cache.resolveStreams(entities)) as CSStream[];

						// // Subscribe to any new non-file, non-team streams
						// this.subscribeCore([
						// 	...Iterables.filterMap(
						// 		streams,
						// 		s =>
						// 			CodeStreamApi.isStreamSubscriptionRequired(s, this._userId!)
						// 				? `stream-${s.id}`
						// 				: undefined
						// 	)
						// ]);

						this._onDidReceiveMessage.fire({ type: MessageType.Streams, streams: streams });
						break;
					case "users": {
						const users = (await this._cache.resolveUsers(entities)) as CSUser[];
						this._onDidReceiveMessage.fire({ type: MessageType.Users, users });
						break;
					}
					case "teams": {
						const teams = (await this._cache.resolveTeams(entities)) as CSTeam[];
						this._onDidReceiveMessage.fire({ type: MessageType.Teams, teams });
						break;
					}
					case "markers": {
						const markers = (await this._cache.resolveMarkers(entities)) as CSMarker[];
						this._onDidReceiveMessage.fire({ type: MessageType.Markers, markers });
						break;
					}
				}
			} catch (ex) {
				Logger.error(ex, `PubNub '${key}' FAILED`);
			}
		}
	}
}

// interface PubNubErrorStatus {
// 	error: boolean;
// 	category: string; // Pubnub.Categories;
// 	operation: Pubnub.Operations;
// 	statusCode: number;
// 	errorData: {
// 		status: number;
// 		response: {
// 			text: string;
// 		};
// 	};
// }

// interface PubNubAccessDeniedErrorResponse {
// 	message: string;
// 	payload: {
// 		channels: string[];
// 		error: boolean;
// 		service: string;
// 		status: number;
// 	};
// }
