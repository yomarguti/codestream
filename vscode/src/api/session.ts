'use strict';
import { ConfigurationChangeEvent, Disposable, Event, EventEmitter, Uri } from 'vscode';
import { CodeStreamApi, CSRepository, CSStream, LoginResponse, PresenceStatus } from './api';
import { configuration } from '../configuration';
import { Container } from '../container';
import { CodeStreamSessionApi } from './sessionApi';
import { Logger } from '../logger';
import { Marker, MarkerCollection } from './models/markers';
import { Post } from './models/posts';
import { PresenceManager } from './presence';
import { PresenceMiddleware } from './presenceMiddleware';
import { MessageReceivedEvent, MessageType, PostsMessageReceivedEvent, PubNubReceiver, RepositoriesMessageReceivedEvent, StreamsMessageReceivedEvent } from './pubnub';
import { Repository, RepositoryCollection } from './models/repositories';
import { ChannelStream, ChannelStreamCollection, DirectStream, DirectStreamCollection, FileStream, Stream, StreamThread, StreamType } from './models/streams';
import { StreamVisibilityManager } from './streamVisibility';
import { Functions, memoize, Strings } from '../system';
import { Team, TeamCollection } from './models/teams';
import { User, UserCollection } from './models/users';

export { ChannelStream, DirectStream, FileStream, Marker, MarkerCollection, Post, PresenceStatus, Repository, Stream, StreamThread, StreamType, Team, User };

export class CodeStreamSession extends Disposable {

    private static _sessions: Map<string, Promise<CodeStreamSession>> = new Map();

    static findRepo(serverUrl: string, repoUrl: string, firstCommitHashes: string[]) {
        return new CodeStreamApi(serverUrl).findRepo(repoUrl, firstCommitHashes);
    }

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

    email: string | undefined;

    private _disposable: Disposable | undefined;
    private _disposableSignedIn: Disposable | undefined;

    private _api: CodeStreamApi;
    private _sessionApi: CodeStreamSessionApi | undefined;
    private readonly _pubnub: PubNubReceiver;

    private _presenceManager: PresenceManager | undefined;
    private _streamVisibilityManager: StreamVisibilityManager | undefined;

    constructor(
        private _serverUrl: string
    ) {
        super(() => this.dispose());

        this._api = new CodeStreamApi(_serverUrl);
        this._pubnub = new PubNubReceiver(),

        this._disposable = Disposable.from(
            this._pubnub.onDidReceiveMessage(this.onMessageReceived, this),
            configuration.onDidChange(this.onConfigurationChanged, this)
        );
    }

    dispose() {
        this._disposable && this._disposable.dispose();
        this._disposableSignedIn && this._disposableSignedIn.dispose();
    }

    private async onConfigurationChanged(e: ConfigurationChangeEvent) {
        if (configuration.changed(e, configuration.name('serverUrl').value)) {
            this._serverUrl = Container.config.serverUrl;
            this._api.baseUrl = this._serverUrl;

            if (this.signedIn) {
                this.logout();
            }
        }

        if (configuration.changed(e, configuration.name('username').value) ||
            configuration.changed(e, configuration.name('password').value)) {
            if (this.signedIn) {
                this.logout();
            }
        }
    }

    private onGitRepositoriesChanged() {
        this.fireChanged({

        } as GitChangedEvent);
        this._onDidChange.fire();
    }

    private onMessageReceived(e: MessageReceivedEvent) {
        switch (e.type) {
            case MessageType.Posts:
                this.firePostsReceived(new PostsReceivedEvent(this, e));
                break;
            case MessageType.Repositories:
                this.fireChanged(new RepositoriesAddedEvent(this, e));
                break;
            case MessageType.Streams:
                this.fireChanged(new StreamsAddedEvent(this, e));
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
                    }
                    else {
                        (found as IMergeableEvent<SessionChangedEvent>).merge(current);
                    }
                    return combined;
                },
                250);
        }
        this._changedDebounced(e);
    }

    private _postsReceivedDebounced: ((e: PostsReceivedEvent) => void) | undefined;
    protected firePostsReceived(e: PostsReceivedEvent) {
        // HACK: If we get a message in a hidden stream, show it again
        for (const p of e.entities()) {
            this.streamVisibility.show(p.streamId);
        }

        if (this._postsReceivedDebounced === undefined) {
            this._postsReceivedDebounced = Functions.debounceMerge(
                (e: PostsReceivedEvent) => this._onDidReceivePosts.fire(e),
                (combined: PostsReceivedEvent[] | undefined, current: PostsReceivedEvent) => {
                    if (combined === undefined) return [current];

                    combined[0].merge(current);
                    return combined;
                },
                250, { maxWait: 1000 });
        }
        this._postsReceivedDebounced(e);
    }

    @signedIn
    get api(): CodeStreamSessionApi {
        return this._sessionApi!;
    }

    private _channels: ChannelStreamCollection | undefined;
    get channels() {
        if (this._channels === undefined) {
            this._channels = new ChannelStreamCollection(this, this.teamId!);
        }
        return this._channels;
    }

    private _directMessages: DirectStreamCollection | undefined;
    get directMessages() {
        if (this._directMessages === undefined) {
            this._directMessages = new DirectStreamCollection(this, this.teamId!);
        }
        return this._directMessages;
    }

    private _id: string | undefined;
    get id() {
        return this._id;
    }

    @signedIn
    get presence() {
        return this._presenceManager!;
    }

    private _repos: RepositoryCollection | undefined;
    @signedIn
    get repos() {
        if (this._repos === undefined) {
            this._repos = new RepositoryCollection(this, this.teamId!);
        }
        return this._repos;
    }

    get serverUrl() {
        return this._serverUrl;
    }

    get signedIn() {
        return this._status === SessionStatus.SignedIn;
    }

    private _status: SessionStatus = SessionStatus.SignedOut;
    get status() {
        return this._status;
    }

    @signedIn
    get streamVisibility() {
        return this._streamVisibilityManager!;
    }

    private _team: Team | undefined;
    @signedIn
    get team() {
        if (this._team === undefined) {
            this._team = new Team(this, this.data.teams.find(t => t.id === this.teamId)!);
        }
        return this._team!;
    }

    private _teams: TeamCollection | undefined;
    @signedIn
    get teams() {
        if (this._teams === undefined) {
            this._teams = new TeamCollection(this, this.data.teams.map(t => t.id));
        }
        return this._teams;
    }

    private _user: User | undefined;
    @signedIn
    get user() {
        if (this._user === undefined) {
            this._user = new User(this, this.data.user);
        }
        return this._user!;
    }

    get userId() {
        return this._data!.user.id;
    }

    private _users: UserCollection | undefined;
    @signedIn
    get users() {
        if (this._users === undefined) {
            this._users = new UserCollection(this, this.teamId!);
        }
        return this._users;
    }

    private _data: LoginResponse | undefined;
    private get data(): LoginResponse {
        return this._data!;
    }

    private get pubnubKey() {
        return this.data.pubnubKey;
    }

    private _teamId: string | undefined;
    private get teamId(): string | undefined {
        return this._teamId;
    }

    private get token(): string {
        return this.data.accessToken;
    }

    async login(email: string, password: string, teamId?: string): Promise<void> {
        const id = Strings.sha1(`${this.serverUrl}|${email}|${password}|${teamId}`);
        let session = CodeStreamSession._sessions.get(id);
        if (session !== undefined) return;

        session = this.loginCore(email, password, teamId);
        this._id = id;
        CodeStreamSession._sessions.set(id, session);

        await session;
    }

    logout() {
        if (this._id !== undefined) {
            CodeStreamSession._sessions.delete(this._id);
        }

        this._id = undefined;
        this._status = SessionStatus.SignedOut;
        setImmediate(() => this._onDidChangeStatus.fire({ getStatus: () => this._status }));

        if (this._disposableSignedIn !== undefined) {
            this._disposableSignedIn.dispose();
            this._disposableSignedIn = undefined;
        }
    }

    @signedIn
    getDefaultTeamChannel() {
        return this.channels.getOrCreateByName('general', { membership: 'auto' });
    }

    @signedIn
    async getMarkers(uri: Uri): Promise<MarkerCollection | undefined> {
        const repo = await this.getRepositoryByUri(uri);
        if (repo === undefined) return undefined;

        return repo.getMarkers(uri);
    }

    @signedIn
    getRepositoryByUri(uri: Uri): Promise<Repository | undefined> {
        return this.repos.getByFileUri(uri);
    }

    @signedIn
    async getStream(streamId: string): Promise<Stream | undefined> {
        const stream = await this.api.getStream(streamId);
        if (stream === undefined) return undefined;

        switch (stream.type) {
            case StreamType.Channel: return new ChannelStream(this, stream);
            case StreamType.Direct: return new DirectStream(this, stream);
            case StreamType.File: return new FileStream(this, stream);
            default: throw new Error('Invalid stream type');
        }
    }

    @signedIn
    hasSingleRepo(): Promise<boolean> {
        return Promise.resolve(this._data!.repos.length === 1);
    }

    @signedIn
    hasSingleTeam(): Promise<boolean> {
        return Promise.resolve(this._data!.teams.length === 1);
    }

    private async loginCore(email: string, password: string, teamId?: string): Promise<CodeStreamSession> {
        Logger.log(`Signing ${email} into CodeStream (${this.serverUrl})`);

        try {
            this._status = SessionStatus.SigningIn;
            const e = { getStatus: () => this._status };
            this._onDidChangeStatus.fire(e);

            this._data = await this._api.login(email, password);

            if (teamId == null) {
                if (this.data.repos.length > 0) {
                    for (const repo of await Container.git.getRepositories()) {
                        const url = await repo.getNormalizedUrl();

                        const found = this._data.repos.find(r => r.normalizedUrl === url);
                        if (found === undefined) continue;

                        teamId = found.teamId;
                        break;
                    }
                }

                if (teamId == null) {
                    teamId = this._data.teams[0].id;
                }
            }

            const team = this._data.teams.find(t => t.id === teamId);
            if (team === undefined) throw new Error(`Unable to find team id ${teamId}`);

            this._teamId = teamId;
            this._sessionApi = new CodeStreamSessionApi(this._api, this.token, teamId);

            this._streamVisibilityManager = new StreamVisibilityManager(this.data.user.id);

            const disposables = [
                this._pubnub.initialize(this.token, this.userId, this.pubnubKey),
                Container.git.onDidChangeRepositories(this.onGitRepositoriesChanged, this)
            ];

            const streams = await this._sessionApi.getSubscribeableStreams(teamId);
            this._pubnub.subscribe(this.userId, teamId, this._data.repos.map(r => r.id), streams.map(s => s.id));

            this._presenceManager = new PresenceManager(this._sessionApi, this.id!);

            this._disposableSignedIn = Disposable.from(
                ...disposables,
                this._presenceManager,
                this._api.useMiddleware(new PresenceMiddleware(this._presenceManager))
            );

            this._presenceManager.online();

            Logger.log(`${email} signed into CodeStream (${this.serverUrl})`);
            this._status = SessionStatus.SignedIn;
            this._onDidChangeStatus.fire(e);

            return this;
        }
        catch (ex) {
            Logger.error(ex);
            this.logout();

            throw ex;
        }
    }
}

interface IMergeableEvent<T> {
    merge(e: T): void;
}

export class PostsReceivedEvent {

    constructor(
        private readonly session: CodeStreamSession,
        private readonly _event: PostsMessageReceivedEvent
    ) { }

    get count() {
        return this._event.posts.length;
    }

    affects(id: string, type: 'stream' | 'repo' | 'team' = 'stream') {
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
    Git = 'git',
    Repositories = 'repos',
    Streams = 'streams'
}

export interface GitChangedEvent extends IMergeableEvent<GitChangedEvent> {
    readonly type: SessionChangedType.Git;
    merge: (e: GitChangedEvent) => void;
}

export class RepositoriesAddedEvent implements IMergeableEvent<RepositoriesAddedEvent> {
    readonly type = SessionChangedType.Repositories;

    constructor(
        private readonly session: CodeStreamSession,
        private readonly _event: RepositoriesMessageReceivedEvent
    ) { }

    get count() {
        return this._event.repos.length;
    }

    affects(id: string, type: 'team' = 'team'): boolean {
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

export class StreamsAddedEvent implements IMergeableEvent<StreamsAddedEvent> {
    readonly type = SessionChangedType.Streams;

    constructor(
        private readonly session: CodeStreamSession,
        private readonly _event: StreamsMessageReceivedEvent
    ) { }

    get count() {
        return this._event.streams.length;
    }

    affects(id: string, type: 'repo' | 'team' = 'repo'): boolean {
        return affects(this._event.streams, id, type);
    }

    entities(): CSStream[] {
        return this._event.streams;
    }

    @memoize
    items(): Stream[] {
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

export type SessionChangedEvent = GitChangedEvent | RepositoriesAddedEvent | StreamsAddedEvent;

export enum SessionStatus {
    SignedOut = 'signedOut',
    SigningIn = 'signingIn',
    SignedIn = 'signedIn'
}

export interface SessionStatusChangedEvent {
    getStatus(): SessionStatus;
}

function affects(data: { [key: string]: any }[], id: string, type: 'stream' | 'repo' | 'team') {
    let key: string;
    switch (type) {
        case 'repo':
            key = 'repoId';
            break;
        case 'stream':
            key = 'streamId';
            break;
        case 'team':
            key = 'teamId';
            break;
        default:
            return false;
    }
    return data.some(i => (i as { [key: string]: any })[key] === id);
}

function signedIn(target: CodeStreamSession, propertyName: string, descriptor: TypedPropertyDescriptor<any>) {
    if (typeof descriptor.value === 'function') {
        const method = descriptor.value;
        descriptor.value = function(this: CodeStreamSession, ...args: any[]) {
            if (!this.signedIn) throw new Error('Not Logged In');
            return method!.apply(this, args);
        };
    }
    else if (typeof descriptor.get === 'function') {
        const get = descriptor.get;
        descriptor.get = function(this: CodeStreamSession, ...args: any[]) {
            if (!this.signedIn) throw new Error('Not Logged In');
            return get!.apply(this, args);
        };
    }
}