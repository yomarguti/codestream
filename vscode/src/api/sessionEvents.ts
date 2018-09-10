"use strict";
import { Uri } from "vscode";
import { memoize } from "../system";
import { WebviewIpcMessage, WebviewIpcMessageType } from "../webviews/webviewIpc";
import { StreamType } from "./api";
import {
	PostsMessageReceivedEvent,
	RepositoriesMessageReceivedEvent,
	StreamsMessageReceivedEvent,
	TeamsMessageReceivedEvent,
	UsersMessageReceivedEvent
} from "./pubnub";
import {
	ChannelStream,
	CodeStreamSession,
	DirectStream,
	FileStream,
	Post,
	Repository,
	SessionSignedOutReason,
	SessionStatus,
	Stream,
	Team,
	User
} from "./session";
import { Unreads } from "./unreads";

export interface SessionStatusChangedEvent {
	getStatus(): SessionStatus;
	session: CodeStreamSession;
	reason?: SessionSignedOutReason;
	unreads?: Unreads;
}

export class TextDocumentMarkersChangedEvent {
	constructor(public readonly session: CodeStreamSession, public readonly uri: Uri) {}
}

export enum SessionChangedEventType {
	Posts = "posts",
	Repositories = "repos",
	Streams = "streams",
	StreamsMembership = "streamsMembership",
	Teams = "teams",
	Users = "users",
	Unreads = "unreads"
}

export interface SessionChangedEvent {
	type: SessionChangedEventType;
}

export interface MergeableEvent<T> extends SessionChangedEvent {
	merge(e: T): void;
}

export function isMergeableEvent<T>(e: SessionChangedEvent): e is MergeableEvent<T> {
	return typeof (e as any).merge === "function";
}

export class PostsChangedEvent {
	readonly type = SessionChangedEventType.Posts;

	constructor(
		public readonly session: CodeStreamSession,
		private readonly _event: PostsMessageReceivedEvent
	) {}

	get count() {
		return this._event.posts.length;
	}

	affects(id: string, type: "entity" | "stream" | "team") {
		return affects(this._event.posts, id, type);
	}

	@memoize
	items() {
		return this._event.posts.map(p => new Post(this.session, p));
	}

	merge(e: PostsChangedEvent) {
		this._event.posts.push(...e._event.posts);
	}

	@memoize
	toIpcMessage(): WebviewIpcMessage {
		return {
			type: WebviewIpcMessageType.didChangeData,
			body: {
				type: this.type,
				payload: this._event.posts
			}
		};
	}
}

export class RepositoriesChangedEvent implements MergeableEvent<RepositoriesChangedEvent> {
	readonly type = SessionChangedEventType.Repositories;

	constructor(
		public readonly session: CodeStreamSession,
		private readonly _event: RepositoriesMessageReceivedEvent
	) {}

	get count() {
		return this._event.repos.length;
	}

	affects(id: string, type: "entity" | "team") {
		return affects(this._event.repos, id, type);
	}

	@memoize
	items(): Repository[] {
		return this._event.repos.map(r => new Repository(this.session, r));
	}

	merge(e: RepositoriesChangedEvent) {
		this._event.repos.push(...e._event.repos);
	}

	@memoize
	toIpcMessage(): WebviewIpcMessage {
		return {
			type: WebviewIpcMessageType.didChangeData,
			body: {
				type: this.type,
				payload: this._event.repos
			}
		};
	}
}

export class StreamsChangedEvent implements MergeableEvent<StreamsChangedEvent> {
	readonly type = SessionChangedEventType.Streams;

	constructor(
		public readonly session: CodeStreamSession,
		private readonly _event: StreamsMessageReceivedEvent
	) {}

	get count() {
		return this._event.streams.length;
	}

	affects(id: string, type: "entity" | "team") {
		return affects(this._event.streams, id, type);
	}

	@memoize
	items(): (Stream | FileStream)[] {
		return this._event.streams.map(s => {
			switch (s.type) {
				case StreamType.Channel:
					return new ChannelStream(this.session, s);
				case StreamType.Direct:
					return new DirectStream(this.session, s);
				case StreamType.File:
					return new FileStream(this.session, s);
			}
		});
	}

	merge(e: StreamsChangedEvent) {
		this._event.streams.push(...e._event.streams);
	}

	@memoize
	toIpcMessage(): WebviewIpcMessage {
		return {
			type: WebviewIpcMessageType.didChangeData,
			body: {
				type: this.type,
				payload: this._event.streams
			}
		};
	}
}

export class StreamsMembershipChangedEvent {
	readonly type = SessionChangedEventType.StreamsMembership;

	constructor(
		public readonly session: CodeStreamSession,
		private readonly _streams: { id: string; teamId: string }[]
	) {}

	get count() {
		return this._streams.length;
	}

	affects(id: string, type: "entity" | "team"): boolean {
		return affects(this._streams, id, type);
	}

	merge(e: StreamsMembershipChangedEvent) {
		this._streams.push(...e._streams);
	}
}

export class TeamsChangedEvent {
	readonly type = SessionChangedEventType.Teams;

	constructor(
		public readonly session: CodeStreamSession,
		private readonly _event: TeamsMessageReceivedEvent
	) {}

	get count() {
		return this._event.teams.length;
	}

	affects(id: string) {
		return affects(this._event.teams, id, "entity");
	}

	@memoize
	items(): Team[] {
		return this._event.teams.map(t => new Team(this.session, t));
	}

	merge(e: TeamsChangedEvent) {
		this._event.teams.push(...e._event.teams);
	}

	@memoize
	toIpcMessage(): WebviewIpcMessage {
		return {
			type: WebviewIpcMessageType.didChangeData,
			body: {
				type: this.type,
				payload: this._event.teams
			}
		};
	}
}

export class UnreadsChangedEvent {
	readonly type = SessionChangedEventType.Unreads;

	constructor(
		public readonly session: CodeStreamSession,
		private readonly _unreads: {
			unread: { [key: string]: number };
			mentions: { [key: string]: number };
		}
	) {}

	@memoize
	unreads(): Unreads {
		return {
			mentions: Object.values(this._unreads.mentions).reduce((total, count) => total + count, 0),
			messages: Object.values(this._unreads.unread).reduce((total, count) => total + count, 0)
		};
	}

	@memoize
	toIpcMessage(): WebviewIpcMessage {
		// TODO: Change this payload to match the other `codestream:data` events
		return {
			type: WebviewIpcMessageType.didChangeUnreads,
			body: this._unreads
		};
	}
}

export class UsersChangedEvent {
	readonly type = SessionChangedEventType.Users;

	constructor(
		public readonly session: CodeStreamSession,
		private readonly _event: UsersMessageReceivedEvent
	) {}

	get count() {
		return this._event.users.length;
	}

	affects(id: string, type: "entity" | "team") {
		return affects(this._event.users, id, type);
	}

	@memoize
	items(): User[] {
		return this._event.users.map(u => new User(this.session, u));
	}

	merge(e: UsersChangedEvent) {
		this._event.users.push(...e._event.users);
	}

	@memoize
	toIpcMessage(): WebviewIpcMessage {
		return {
			type: WebviewIpcMessageType.didChangeData,
			body: {
				type: this.type,
				payload: this._event.users
			}
		};
	}
}

function affects(
	data: { [key: string]: any }[],
	id: string,
	type: "entity" | "stream" | "repo" | "team"
) {
	let key: string;
	switch (type) {
		case "repo":
			key = "repoId";
			break;
		case "stream":
			key = "streamId";
			break;
		case "team":
			key = "teamId";
			break;
		default:
			key = "id";
	}
	return data.some(i => (i as { [key: string]: any })[key] === id);
}
