"use strict";
import { Uri } from "vscode";
import {
	CodemarksChangedNotification,
	CSMePreferences,
	CSUnreads,
	DidChangeDataNotification,
	PostsChangedNotification,
	PreferencesChangedNotification,
	RepositoriesChangedNotification,
	StreamsChangedNotification,
	TeamsChangedNotification,
	UnreadsChangedNotification,
	UsersChangedNotification
} from "../agent/agentConnection";
import { memoize } from "../system";
import { WebviewIpcMessage, WebviewIpcMessageType } from "../webviews/webviewIpc";
import { CodeStreamSession, Post, SessionSignedOutReason, SessionStatus } from "./session";

export interface SessionStatusChangedEvent {
	getStatus(): SessionStatus;
	session: CodeStreamSession;
	reason?: SessionSignedOutReason;
	unreads?: CSUnreads;
}

export class TextDocumentMarkersChangedEvent {
	constructor(public readonly session: CodeStreamSession, public readonly uri: Uri) {}
}

export enum SessionChangedEventType {
	Codemarks = "codemarks",
	Posts = "posts",
	Preferences = "preferences",
	Repositories = "repos",
	Streams = "streams",
	StreamsMembership = "streamsMembership",
	Teams = "teams",
	Unreads = "unreads",
	Users = "users"
}

export interface SessionChangedEvent {
	readonly type: SessionChangedEventType;
}

export interface MergeableEvent<T> extends SessionChangedEvent {
	merge(e: T): void;
}

export function isMergeableEvent<T>(e: SessionChangedEvent): e is MergeableEvent<T> {
	return typeof (e as any).merge === "function";
}

abstract class SessionChangedEventBase<T extends DidChangeDataNotification>
	implements SessionChangedEvent {
	abstract readonly type: SessionChangedEventType;

	constructor(public readonly session: CodeStreamSession, protected readonly _event: T) {}

	@memoize
	toIpcMessage(): WebviewIpcMessage {
		return {
			type: WebviewIpcMessageType.didChangeData,
			body: {
				type: this.type,
				data: this._event.data
			}
		};
	}
}

export class CodemarksChangedEvent extends SessionChangedEventBase<CodemarksChangedNotification>
	implements MergeableEvent<CodemarksChangedEvent> {
	readonly type = SessionChangedEventType.Codemarks;

	get count() {
		return this._event.data.length;
	}

	affects(id: string, type: "entity") {
		return affects(this._event.data, id, type);
	}

	// @memoize
	// items() {
	// 	return this._event.data.map(p => new Cod(this.session, p));
	// }

	merge(e: CodemarksChangedEvent) {
		this._event.data.push(...e._event.data);
	}
}

export class PostsChangedEvent extends SessionChangedEventBase<PostsChangedNotification>
	implements MergeableEvent<PostsChangedEvent> {
	readonly type = SessionChangedEventType.Posts;

	get count() {
		return this._event.data.length;
	}

	affects(id: string, type: "entity" | "stream" | "team") {
		return affects(this._event.data, id, type);
	}

	@memoize
	items() {
		return this._event.data.map(p => new Post(this.session, p));
	}

	merge(e: PostsChangedEvent) {
		this._event.data.push(...e._event.data);
	}
}

export class PreferencesChangedEvent extends SessionChangedEventBase<PreferencesChangedNotification>
	implements MergeableEvent<PreferencesChangedEvent> {
	readonly type = SessionChangedEventType.Preferences;

	@memoize
	preferences(): CSMePreferences {
		return this._event.data;
	}

	merge(e: PreferencesChangedEvent) {
		return { ...this.preferences, ...e.preferences };
	}
}

export class RepositoriesChangedEvent
	extends SessionChangedEventBase<RepositoriesChangedNotification>
	implements MergeableEvent<RepositoriesChangedEvent> {
	readonly type = SessionChangedEventType.Repositories;

	merge(e: RepositoriesChangedEvent) {
		this._event.data.push(...e._event.data);
	}
}

export class StreamsChangedEvent extends SessionChangedEventBase<StreamsChangedNotification>
	implements MergeableEvent<StreamsChangedEvent> {
	readonly type = SessionChangedEventType.Streams;

	merge(e: StreamsChangedEvent) {
		this._event.data.push(...e._event.data);
	}
}

export class TeamsChangedEvent extends SessionChangedEventBase<TeamsChangedNotification>
	implements MergeableEvent<TeamsChangedEvent> {
	readonly type = SessionChangedEventType.Teams;

	merge(e: TeamsChangedEvent) {
		this._event.data.push(...e._event.data);
	}
}

export class UnreadsChangedEvent extends SessionChangedEventBase<UnreadsChangedNotification> {
	readonly type = SessionChangedEventType.Unreads;

	@memoize
	unreads(): CSUnreads {
		return this._event.data;
	}
}

export class UsersChangedEvent extends SessionChangedEventBase<UsersChangedNotification>
	implements MergeableEvent<UsersChangedEvent> {
	readonly type = SessionChangedEventType.Users;

	merge(e: UsersChangedEvent) {
		this._event.data.push(...e._event.data);
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
