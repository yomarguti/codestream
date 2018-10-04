"use strict";
import { Disposable, Event, EventEmitter } from "vscode";
import { CSPost, CSRepository, CSStream, CSTeam, CSUser } from "../agent/agentConnection";
import { Container } from "../container";
import { Logger } from "../logger";

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

export type MessageReceivedEvent =
	| PostsMessageReceivedEvent
	| RepositoriesMessageReceivedEvent
	| StreamsMessageReceivedEvent
	| UsersMessageReceivedEvent
	| TeamsMessageReceivedEvent;

export class PubNubReceiver implements Disposable {
	private _onDidReceiveMessage = new EventEmitter<MessageReceivedEvent>();
	get onDidReceiveMessage(): Event<MessageReceivedEvent> {
		return this._onDidReceiveMessage.event;
	}

	private _disposable: Disposable;

	constructor() {
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
						const posts = entities as CSPost[];
						this._onDidReceiveMessage.fire({ type: MessageType.Posts, posts });
						break;
					case "repos":
						const repos = entities as CSRepository[];
						this._onDidReceiveMessage.fire({ type: MessageType.Repositories, repos });
						break;
					case "streams":
						const streams = entities as CSStream[];
						this._onDidReceiveMessage.fire({ type: MessageType.Streams, streams: streams });
						break;
					case "users": {
						const users = entities as CSUser[];
						this._onDidReceiveMessage.fire({ type: MessageType.Users, users });
						break;
					}
					case "teams": {
						const teams = entities as CSTeam[];
						this._onDidReceiveMessage.fire({ type: MessageType.Teams, teams });
						break;
					}
				}
			} catch (ex) {
				Logger.error(ex, `PubNub '${key}' FAILED`);
			}
		}
	}
}
