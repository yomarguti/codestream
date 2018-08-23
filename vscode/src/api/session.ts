"use strict";
import * as uuid from "uuid/v4";
import { ConfigurationTarget, Disposable, Event, EventEmitter } from "vscode";
import { AccessToken, AgentResult, DocumentMarkersChangedEvent } from "../agent/agentConnection";
import { WorkspaceState } from "../common";
import { configuration } from "../configuration";
import { Container } from "../container";
import { Logger } from "../logger";
import { Functions, memoize, Strings } from "../system";
import { CSPost, CSRepository, CSStream, CSUser, LoginResult, PresenceStatus } from "./api";
import { Cache } from "./cache";
import { Marker } from "./models/markers";
import { Post } from "./models/posts";
import { Repository } from "./models/repositories";
import {
	ChannelStream,
	ChannelStreamCreationOptions,
	DirectStream,
	FileStream,
	Stream,
	StreamThread,
	StreamType
} from "./models/streams";
import { Team } from "./models/teams";
import { User } from "./models/users";
import { PresenceManager } from "./presence";
import { PresenceMiddleware } from "./presenceMiddleware";
import {
	MessageReceivedEvent,
	MessageType,
	PostsMessageReceivedEvent,
	PubNubReceiver,
	RepositoriesMessageReceivedEvent,
	StreamsMessageReceivedEvent,
	TeamsMessageReceivedEvent,
	UsersMessageReceivedEvent
} from "./pubnub";
import { CodeStreamSessionApi } from "./sessionApi";
import { SessionState } from "./sessionState";
import { TokenManager } from "./tokenManager";

export {
	ChannelStream,
	ChannelStreamCreationOptions,
	DirectStream,
	FileStream,
	Marker,
	Post,
	PresenceStatus,
	Repository,
	Stream,
	StreamThread,
	StreamType,
	Team,
	User
};

const envRegex = /https?:\/\/(pd-|qa-)api.codestream.(?:us|com)/;

export enum CodeStreamEnvironment {
	PD = "pd",
	Production = "prod",
	QA = "qa",
	Unknown = "unknown"
}

export class CodeStreamSession implements Disposable {
	private _onDidChange = new EventEmitter<SessionChangedEvent>();
	get onDidChange(): Event<SessionChangedEvent> {
		return this._onDidChange.event;
	}

	private _onDidChangeStatus = new EventEmitter<SessionStatusChangedEvent>();
	get onDidChangeStatus(): Event<SessionStatusChangedEvent> {
		return this._onDidChangeStatus.event;
	}

	private _onDidReceivePosts = new EventEmitter<PostsReceivedEvent>();
	get onDidReceivePosts(): Event<PostsReceivedEvent> {
		return this._onDidReceivePosts.event;
	}

	private _disposable: Disposable | undefined;

	private _email: string | undefined;
	private _environment = CodeStreamEnvironment.Unknown;
	private _id: string | undefined;
	private _loginPromise: Promise<LoginResult> | undefined;
	private _presenceManager: PresenceManager | undefined;
	private _pubnub: PubNubReceiver | undefined;
	private _sessionApi: CodeStreamSessionApi | undefined;
	private _state: SessionState | undefined;
	private _signupToken: string | undefined;

	constructor(private _serverUrl: string) {
		this.setServerUrl(_serverUrl);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	// private async onConfigurationChanged(e: ConfigurationChangeEvent) {
	// 	if (configuration.changed(e, configuration.name("serverUrl").value)) {
	// 		this.setServerUrl(Container.config.serverUrl);
	// 		if (this._sessionApi !== undefined) {
	// 			this._sessionApi.baseUrl = this._serverUrl;
	// 		}
	// 		if (this.signedIn) {
	// 			this.logout();
	// 		}
	// 	}
	// 	if (configuration.changed(e, configuration.name("email").value)) {
	// 		if (this.signedIn) {
	// 			this.logout();
	// 		}
	// 	}
	// }

	private onDocumentMarkersChanged(e: DocumentMarkersChangedEvent) {
		this.fireChanged(new MarkersChangedEvent(this, e));
	}

	private onMessageReceived(e: MessageReceivedEvent) {
		switch (e.type) {
			case MessageType.Posts: {
				this.incrementUnreads(e.posts);

				this.firePostsReceived(new PostsReceivedEvent(this, e));
				break;
			}
			case MessageType.Repositories:
				this.fireChanged(new RepositoriesAddedEvent(this, e));
				break;
			case MessageType.Streams:
				this.fireChanged(new StreamsAddedEvent(this, e));
				break;
			case MessageType.Users:
				const user = e.users.find(u => u.id === this.userId);
				if (user != null) {
					this._state!.updateUser(user);
					this.calculateUnreads(user);
				}

				this.fireChanged(new UsersChangedEvent(this, e));
				break;
			case MessageType.Teams:
				this._state!.updateTeams();

				this.fireChanged(new TeamsChangedEvent(this, e));
				break;
		}
	}

	private _changedDebounced: ((e: SessionChangedEvent) => void) | undefined;
	protected fireChanged(e: SessionChangedEvent) {
		if (this._changedDebounced === undefined) {
			this._changedDebounced = Functions.debounceMerge(
				(e: SessionChangedEvent) => this._onDidChange.fire(e),
				(combined: SessionChangedEvent[] | undefined, current: SessionChangedEvent) => {
					if (combined === undefined) return [current];

					const found = combined.find(_ => _.type === current.type);
					if (found === undefined) {
						combined.push(current);
					} else {
						(found as IMergeableEvent<SessionChangedEvent>).merge(current);
					}
					return combined;
				},
				250
			);
		}
		this._changedDebounced(e);
	}

	private _postsReceivedDebounced: ((e: PostsReceivedEvent) => void) | undefined;
	protected firePostsReceived(e: PostsReceivedEvent) {
		if (this._postsReceivedDebounced === undefined) {
			this._postsReceivedDebounced = Functions.debounceMerge(
				(e: PostsReceivedEvent) => this._onDidReceivePosts.fire(e),
				(combined: PostsReceivedEvent[] | undefined, current: PostsReceivedEvent) => {
					if (combined === undefined) return [current];

					combined[0].merge(current);
					return combined;
				},
				250,
				{ maxWait: 1000 }
			);
		}
		this._postsReceivedDebounced(e);
	}

	get email() {
		return this._email;
	}

	get id() {
		return this._id;
	}

	@signedIn
	get api(): CodeStreamSessionApi {
		return this._sessionApi!;
	}

	@signedIn
	get channels() {
		return this._state!.channels;
	}

	@signedIn
	get channelsAndDMs() {
		return this._state!.channelsAndDMs;
	}

	@signedIn
	get directMessages() {
		return this._state!.directMessages;
	}

	@signedIn
	get presence() {
		return this._presenceManager!;
	}

	@signedIn
	get repos() {
		return this._state!.repos;
	}

	get environment(): CodeStreamEnvironment {
		return this._environment;
	}

	get serverUrl(): string {
		return this._serverUrl;
	}
	private setServerUrl(url: string) {
		this._serverUrl = url;
		this._environment = CodeStreamEnvironment.Unknown;

		const match = envRegex.exec(url);
		if (match == null) return;

		switch (match[1].toLowerCase()) {
			case "pd-":
				this._environment = CodeStreamEnvironment.PD;
				break;
			case "qa-":
				this._environment = CodeStreamEnvironment.QA;
				break;
			default:
				this._environment = CodeStreamEnvironment.Production;
				break;
		}
	}

	get signedIn() {
		return this._status === SessionStatus.SignedIn;
	}

	private _status: SessionStatus = SessionStatus.SignedOut;
	get status() {
		return this._status;
	}

	@signedIn
	get team() {
		return this._state!.team;
	}

	@signedIn
	get teams() {
		return this._state!.teams;
	}

	@signedIn
	get user() {
		return this._state!.user;
	}

	get userId() {
		return this._state!.userId;
	}

	@signedIn
	get users() {
		return this._state!.users;
	}

	@signedIn
	get unreads() {
		return this._state!.unreads;
	}

	getSignupToken() {
		if (!this._signupToken) this._signupToken = uuid();

		return this._signupToken;
	}

	async login(email: string, password: string, teamId?: string): Promise<LoginResult>;
	async login(email: string, token: AccessToken, teamId?: string): Promise<LoginResult>;
	async login(
		email: string,
		passwordOrToken: string | AccessToken,
		teamId?: string
	): Promise<LoginResult> {
		if (this._loginPromise === undefined) {
			this._loginPromise = this.loginCore(email, passwordOrToken, teamId);
		}

		const result = await this._loginPromise;
		if (result !== LoginResult.Success) {
			this._loginPromise = undefined;
		}
		return result;
	}

	async loginViaSignupToken(): Promise<LoginResult> {
		// TODO: reuse this._loginPromise
		if (this._signupToken === undefined) throw new Error("A signup token hasn't been generated");

		this.setServerUrl(Container.config.serverUrl);

		this._status = SessionStatus.SigningIn;
		const e: SessionStatusChangedEvent = { getStatus: () => this._status };
		this._onDidChangeStatus.fire(e);

		const result = await Container.agent.loginViaSignupToken(this._serverUrl, this._signupToken);

		if (result.error) {
			this._status = SessionStatus.SignedOut;
			e.reason = SessionStatusSignedOutReason.SignInFailure;
			this._onDidChangeStatus.fire(e);

			if (result.error !== LoginResult.NotOnTeam && result.error !== LoginResult.NotConfirmed) {
				this._signupToken = undefined;
			}

			return result.error;
		}

		await this.completeLogin(result, this._signupToken);
		return LoginResult.Success;
	}

	async logout(reset: boolean = true) {
		this._id = undefined;
		this._loginPromise = undefined;

		if (reset) {
			// Clear the access token
			await TokenManager.clear(this._serverUrl, this._email!);
		}

		this._email = undefined;
		this._status = SessionStatus.SignedOut;

		if (Container.agent !== undefined) {
			void (await Container.agent.logout());
		}

		if (this._disposable !== undefined) {
			this._disposable.dispose();
			this._disposable = undefined;
		}

		// Clean up saved state
		this._presenceManager = undefined;
		this._pubnub = undefined;
		this._sessionApi = undefined;
		this._state = undefined;
		this._signupToken = undefined;

		setImmediate(() => this._onDidChangeStatus.fire({ getStatus: () => this._status }));
	}

	@signedIn
	async getStream(streamId: string): Promise<Stream | undefined> {
		const stream = await this.api.getStream(streamId);
		if (stream === undefined) return undefined;

		switch (stream.type) {
			case StreamType.Channel:
				return new ChannelStream(this, stream);
			case StreamType.Direct:
				return new DirectStream(this, stream);
			default:
				throw new Error("Invalid stream type");
		}
	}

	@signedIn
	hasSingleTeam(): Promise<boolean> {
		return this._state!.hasSingleTeam();
	}

	@signedIn
	notify(e: SessionChangedEvent) {
		this._onDidChange.fire(e);
	}

	private async loginCore(
		email: string,
		passwordOrToken: string | AccessToken,
		teamId?: string
	): Promise<LoginResult> {
		this.setServerUrl(Container.config.serverUrl);
		Logger.log(`Signing ${email} into CodeStream (${this.serverUrl})`);

		try {
			this._status = SessionStatus.SigningIn;
			const e: SessionStatusChangedEvent = { getStatus: () => this._status };
			this._onDidChangeStatus.fire(e);

			if (!teamId) {
				// If there is a configuration settings for a team, use that above others
				teamId = Container.config.team
					? undefined
					: Container.context.workspaceState.get(WorkspaceState.TeamId);
			}

			const result = await Container.agent.login(
				this._serverUrl,
				email,
				passwordOrToken,
				teamId,
				Container.config.team
			);

			if (result.error) {
				// Clear the access token
				await TokenManager.clear(this._serverUrl, email);

				this._status = SessionStatus.SignedOut;
				e.reason = SessionStatusSignedOutReason.SignInFailure;
				this._onDidChangeStatus.fire(e);

				return result.error;
			}

			await this.completeLogin(result, teamId);

			return LoginResult.Success;
		} catch (ex) {
			ex.message = ex.message.replace("Request initialize failed with message: ", "CodeStream: ");

			Logger.error(ex);
			void (await this.logout(false));

			throw ex;
		}
	}

	private async completeLogin(result: AgentResult, teamId?: string) {
		const email = result.loginResponse.user.email;
		this._email = email;

		// Create an id for this session
		// TODO: Probably needs to be more unique
		this._id = Strings.sha1(`${this.serverUrl}|${email}|${teamId}`.toLowerCase());

		await TokenManager.addOrUpdate(this._serverUrl, email, result.loginResponse.accessToken);

		// Update the saved e-mail on successful login
		if (email !== Container.config.email) {
			let target = ConfigurationTarget.Global;

			// Determine where to best save the e-mail
			const emailSetting = configuration.inspect(configuration.name("email").value);
			// If we have an e-mail in the workspace, save it to the workspace
			if (emailSetting !== undefined && emailSetting.workspaceValue !== undefined) {
				target = ConfigurationTarget.Workspace;
			} else {
				// If we don't have an e-mail in the workspace, check if the serverUrl is in the workspace
				const serverUrlSetting = configuration.inspect(configuration.name("serverUrl").value);
				// If we have a serverUrl in the workspace, save the e-mail to the workspace
				if (serverUrlSetting !== undefined && serverUrlSetting.workspaceValue !== undefined) {
					target = ConfigurationTarget.Workspace;
				}
			}

			await configuration.update(configuration.name("email").value, email, target);
		}

		if (!teamId || teamId !== result.state.teamId) {
			teamId = result.state.teamId;
			await Container.context.workspaceState.update(WorkspaceState.TeamId, teamId);
		}

		this._pubnub = new PubNubReceiver(new Cache(this));
		this._state = new SessionState(this, teamId, result.loginResponse);
		this._sessionApi = new CodeStreamSessionApi(this._serverUrl, this._state.token, teamId);
		this._presenceManager = new PresenceManager(this._sessionApi, this._id);

		this.calculateUnreads(result.loginResponse.user);

		this._disposable = Disposable.from(
			Container.agent.onDidChangeDocumentMarkers(this.onDocumentMarkersChanged, this),
			this._pubnub.onDidReceiveMessage(this.onMessageReceived, this),
			this._pubnub,
			// configuration.onDidChange(this.onConfigurationChanged, this),
			this._presenceManager,
			this._sessionApi.useMiddleware(new PresenceMiddleware(this._presenceManager))
		);

		this._presenceManager.online();

		Logger.log(
			`${email} signed into CodeStream (${this.serverUrl}); userId=${this.userId}, teamId=${teamId}`
		);

		this._status = SessionStatus.SignedIn;
		this._onDidChangeStatus.fire({ getStatus: () => this._status });
	}

	private async calculateUnreads(user: CSUser) {
		const lastReads = user.lastReads || {};
		const unreadCounter = this._state!.unreads;
		const entries = Object.entries(lastReads);
		const unreadStreams = await this._sessionApi!.getUnreadStreams();
		await Promise.all(
			entries.map(async ([streamId, lastReadSeqNum]) => {
				const stream = unreadStreams.find(stream => stream.id === streamId);
				if (stream) {
					let latestPost;
					let unreadPosts;
					try {
						latestPost = await this._sessionApi!.getLatestPost(streamId);
						unreadPosts = await this._sessionApi!.getPostsInRange(
							streamId,
							lastReadSeqNum + 1,
							latestPost.seqNum
						);
					} catch (error) {
						// likely an access error because user is no longer in this channel
						debugger;
						return;
					}

					let unreadCount = 0;
					let mentionCount = 0;
					unreadPosts.forEach(post => {
						if (!post.deactivated) {
							const mentionedUserIds = post.mentionedUserIds || [];
							if (mentionedUserIds.includes(user.id) || stream.type === StreamType.Direct) {
								mentionCount++;
								unreadCount++;
							} else {
								unreadCount++;
							}
						}
					});
					unreadCounter.mentions[streamId] = mentionCount;
					unreadCounter.unread[streamId] = unreadCount;
				}
			})
		);

		unreadCounter.getStreamIds().forEach(streamId => {
			if (lastReads[streamId] === undefined) {
				unreadCounter.clear(streamId);
			}
		});

		unreadCounter.lastReads = lastReads;
		this._onDidChange.fire(new UnreadsChangedEvent(unreadCounter.getValues()));
	}

	private async incrementUnreads(posts: CSPost[]) {
		const unreadCounter = this._state!.unreads;

		await Promise.all(
			posts.map(async post => {
				if (!post.deactivated && !post.hasBeenEdited && post.creatorId !== this.userId) {
					const stream = await this._sessionApi!.getStream(post.streamId);
					const mentionedUserIds = post.mentionedUserIds || [];
					if (mentionedUserIds.includes(this.user.id) || stream!.type === StreamType.Direct) {
						unreadCounter.incrementMention(post.streamId);
						unreadCounter.incrementUnread(post.streamId);
					} else {
						unreadCounter.incrementUnread(post.streamId);
					}
					if (unreadCounter.lastReads[post.streamId] === undefined) {
						unreadCounter.lastReads[post.streamId] = post.seqNum - 1;
					}
				}
			})
		);
		this._onDidChange.fire(new UnreadsChangedEvent(this._state!.unreads.getValues()));
	}
}

interface IMergeableEvent<T> {
	merge(e: T): void;
}

export class PostsReceivedEvent {
	constructor(
		private readonly session: CodeStreamSession,
		private readonly _event: PostsMessageReceivedEvent
	) {}

	get count() {
		return this._event.posts.length;
	}

	affects(id: string, type: "entity" | "stream" | "repo" | "team" = "stream") {
		return affects(this._event.posts, id, type);
	}

	entities() {
		return this._event.posts;
	}

	@memoize
	items() {
		return this._event.posts.map(p => new Post(this.session, p));
	}

	merge(e: PostsReceivedEvent) {
		this._event.posts.push(...e._event.posts);
	}
}

export enum SessionChangedType {
	Repositories = "repos",
	Streams = "streams",
	StreamsMembership = "streamsMembership",
	Teams = "teams",
	Markers = "markers",
	Users = "users",
	Unreads = "unreads"
}

export class RepositoriesAddedEvent implements IMergeableEvent<RepositoriesAddedEvent> {
	readonly type = SessionChangedType.Repositories;

	constructor(
		private readonly session: CodeStreamSession,
		private readonly _event: RepositoriesMessageReceivedEvent
	) {}

	get count() {
		return this._event.repos.length;
	}

	affects(id: string, type: "entity" | "team" = "team"): boolean {
		return affects(this._event.repos, id, type);
	}

	entities(): CSRepository[] {
		return this._event.repos;
	}

	@memoize
	items(): Repository[] {
		return this._event.repos.map(r => new Repository(this.session, r));
	}

	merge(e: RepositoriesAddedEvent) {
		this._event.repos.push(...e._event.repos);
	}
}

export class StreamsMembershipChangedEvent {
	readonly type = SessionChangedType.StreamsMembership;

	constructor(private readonly streamId: string, private readonly teamId: string) {}

	affects(id: string, type: "entity" | "team" = "entity"): boolean {
		if (type === "entity" && id === this.streamId) {
			return true;
		}
		if (type === "team" && id === this.teamId) {
			return true;
		}
		return false;
	}
}

export class StreamsAddedEvent implements IMergeableEvent<StreamsAddedEvent> {
	readonly type = SessionChangedType.Streams;

	constructor(
		private readonly session: CodeStreamSession,
		private readonly _event: StreamsMessageReceivedEvent
	) {}

	get count() {
		return this._event.streams.length;
	}

	affects(id: string, type: "entity" | "team" = "entity"): boolean {
		return affects(this._event.streams, id, type);
	}

	entities(): CSStream[] {
		return this._event.streams;
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

	merge(e: StreamsAddedEvent) {
		this._event.streams.push(...e._event.streams);
	}
}

class UsersChangedEvent {
	readonly type = SessionChangedType.Users;

	constructor(
		private readonly session: CodeStreamSession,
		private readonly _event: UsersMessageReceivedEvent
	) {}

	affects(id: string, type: "entity" | "team" = "entity") {
		return affects(this._event.users, id, type);
	}

	entities() {
		return this._event.users;
	}

	@memoize
	items(): User[] {
		return this._event.users.map(u => new User(this.session, u));
	}
}

class TeamsChangedEvent {
	readonly type = SessionChangedType.Teams;

	constructor(
		private readonly session: CodeStreamSession,
		private readonly _event: TeamsMessageReceivedEvent
	) {}

	affects(id: string, type: "entity" = "entity") {
		return affects(this._event.teams, id, type);
	}

	entities() {
		return this._event.teams;
	}

	@memoize
	items(): Team[] {
		return this._event.teams.map(t => new Team(this.session, t));
	}
}

class MarkersChangedEvent {
	readonly type = SessionChangedType.Markers;

	constructor(
		public readonly session: CodeStreamSession,
		private readonly _event: DocumentMarkersChangedEvent
	) {}

	get uri() {
		return this._event.uri;
	}
}

export class UnreadsChangedEvent {
	readonly type = SessionChangedType.Unreads;

	constructor(
		public readonly unreads: {
			unread: { [key: string]: number };
			mentions: { [key: string]: number };
		}
	) {}

	getMentionCount() {
		return Object.values(this.unreads.mentions).reduce((total, count) => total + count, 0);
	}
}

export type SessionChangedEvent =
	| RepositoriesAddedEvent
	| StreamsAddedEvent
	| StreamsMembershipChangedEvent
	| UsersChangedEvent
	| TeamsChangedEvent
	| MarkersChangedEvent
	| UnreadsChangedEvent;

export enum SessionStatus {
	SignedOut = "signedOut",
	SigningIn = "signingIn",
	SignedIn = "signedIn"
}

export enum SessionStatusSignedOutReason {
	SignInFailure = "signInFailure"
}

export interface SessionStatusChangedEvent {
	getStatus(): SessionStatus;
	reason?: SessionStatusSignedOutReason;
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

function signedIn(
	target: CodeStreamSession,
	propertyName: string,
	descriptor: TypedPropertyDescriptor<any>
) {
	if (typeof descriptor.value === "function") {
		const method = descriptor.value;
		descriptor.value = function(this: CodeStreamSession, ...args: any[]) {
			if (!this.signedIn) throw new Error("Not Logged In");
			return method!.apply(this, args);
		};
	} else if (typeof descriptor.get === "function") {
		const get = descriptor.get;
		descriptor.get = function(this: CodeStreamSession, ...args: any[]) {
			if (!this.signedIn) throw new Error("Not Logged In");
			return get!.apply(this, args);
		};
	}
}
