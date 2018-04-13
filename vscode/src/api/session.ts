'use strict';
import { ConfigurationChangeEvent, Disposable, Event, EventEmitter, Uri } from 'vscode';
import { Iterables, Strings } from '../system';
import { configuration } from '../configuration';
import {
    CodeStreamApi,
    LoginResponse,
    Markers, Repository, RepositoryCollection, Stream, StreamCollection, UserCollection
} from './api';
import { CodeStreamSessionApi } from './sessionApi';
import { Git } from '../git/git';
import { PubNubReceiver } from './pubnub';
import { Container } from '../container';

export { Markers, Post, Repository, Stream, User } from './api';

function signedIn(target: CodeStreamSession, propertyName: string, descriptor: TypedPropertyDescriptor<any>) {
    if (typeof descriptor.value === 'function') {
        const method = descriptor.value;
        descriptor.value = function(this: CodeStreamSession) {
            if (!this.signedIn) throw new Error('Not Logged In');
            return method!.apply(this, arguments);
        };
    }
    else if (typeof descriptor.get === 'function') {
        const get = descriptor.get;
        descriptor.get = function(this: CodeStreamSession) {
            if (!this.signedIn) throw new Error('Not Logged In');
            return get!.apply(this, arguments);
        };
    }
}

export enum SessionStatus {
    SignedOut = 'signedOut',
    SigningIn = 'signingIn',
    SignedIn = 'signedIn'
}

export interface SessionStatusChangedEvent {
    getStatus(): SessionStatus;
}

export class CodeStreamSession extends Disposable {

    private static _sessions: Map<string, Promise<CodeStreamSession>> = new Map();

    static findRepo(serverUrl: string, repoUrl: string, firstCommitHashes: string[]) {
        return new CodeStreamApi(serverUrl).findRepo(repoUrl, firstCommitHashes);
    }

    private _onDidChange = new EventEmitter<void>();
    get onDidChange(): Event<void> {
        return this._onDidChange.event;
    }

    private _onDidChangeStatus = new EventEmitter<SessionStatusChangedEvent>();
    get onDidChangeStatus(): Event<SessionStatusChangedEvent> {
        return this._onDidChangeStatus.event;
    }

    public email: string | undefined;

    private _disposable: Disposable | undefined;
    private _disposableSignedIn: Disposable | undefined;

    private _api: CodeStreamApi;
    private _sessionApi: CodeStreamSessionApi | undefined;
    private readonly _git: Git;
    private readonly _pubnub: PubNubReceiver;

    constructor(
        private _serverUrl: string
    ) {
        super(() => this.dispose());

        this._api = new CodeStreamApi(_serverUrl);
        this._pubnub = new PubNubReceiver(),

        this._disposable = Disposable.from(
            this._git = new Git(),
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
        this._onDidChange.fire();
    }

    @signedIn
    get api(): CodeStreamSessionApi {
        return this._sessionApi!;
    }

    @signedIn
    get hasSingleRepo(): Promise<boolean> {
        return Promise.resolve(this._data!.repos.length === 1);
    }

    @signedIn
    get hasSingleTeam(): Promise<boolean> {
        return Promise.resolve(this._data!.teams.length === 1);
    }

    private _id: string | undefined;
    get id() {
        return this._id;
    }

    private _repos: RepositoryCollection | undefined;
    @signedIn
    get repos() {
        if (this._repos === undefined) {
            this._repos = new RepositoryCollection(this);
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

    private _streams: StreamCollection | undefined;
    get streams() {
        if (this._streams === undefined) {
            this._streams = new StreamCollection(this);
        }
        return this._streams;
    }

    private _users: UserCollection | undefined;
    @signedIn
    get users() {
        if (this._users === undefined) {
            this._users = new UserCollection(this);
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

    private get userId() {
        return this._data!.user.id;
    }

    async login(email: string, password: string, teamId?: string): Promise<void> {
        const id = Strings.sha1(`${this.serverUrl}|${email}|${password}|${teamId}`);
        let session = CodeStreamSession._sessions.get(id);
        if (session !== undefined) return;

        session = this.loginCore(email, password, teamId);
        this._id = id;
        CodeStreamSession._sessions.set(id, session);
    }

    logout() {
        if (this._id !== undefined) {
            CodeStreamSession._sessions.delete(this._id);
        }

        this._id = undefined;
        this._status = SessionStatus.SignedOut;
        this._onDidChangeStatus.fire({ getStatus: () => this._status });

        if (this._disposableSignedIn !== undefined) {
            this._disposableSignedIn.dispose();
            this._disposableSignedIn = undefined;
        }
    }

    @signedIn
    async getMarkers(uri: Uri): Promise<Markers | undefined> {
        const repo = await this.getRepositoryByUri(uri);
        if (repo === undefined) return undefined;

        return repo.getMarkers(uri);
    }

    @signedIn
    getRepositoryByUri(uri: Uri): Promise<Repository | undefined> {
        return this.repos.getByUri(uri);
    }

    @signedIn
    async post(text: string) {
        // HACK: Pretend we have 1 stream for now
        const streams = await this.streams.items;

        let stream = Iterables.first(streams);
        if (stream === undefined) {
            const repos = await this.repos.items;
            const repo = Iterables.first(repos);

            if (repo === undefined) throw new Error(`No repositories!`);

            const s = await this.api.createStream(Uri.parse(`repo://${repo.url}`), repo.id);
            if (s === undefined) throw new Error(`Unable to create stream`);

            stream = new Stream(this, s);
        }

        return stream.post(text);
    }

    private async loginCore(email: string, password: string, teamId?: string): Promise<CodeStreamSession> {
        try {
            this._status = SessionStatus.SigningIn;
            const e = { getStatus: () => this._status };
            this._onDidChangeStatus.fire(e);

            this._data = await this._api.login(email, password);

            if (teamId === undefined) {
                teamId = this._data.teams[0].id;
            }

            const team = this._data.teams.find(t => t.id === teamId);
            if (team === undefined) throw new Error(`Unable to find team id ${teamId}`);

            this._teamId = team.id;
            this._sessionApi = new CodeStreamSessionApi(this._api, this.token, this.teamId!);

            this._disposableSignedIn = Disposable.from(
                this._pubnub.initialize(this.token, this.userId, this.pubnubKey),
                this._git.onDidChangeRepositories(this.onGitRepositoriesChanged, this)
            );

            this._pubnub.subscribe(this.userId, this.teamId!, this._data.repos[0].id);

            this._status = SessionStatus.SignedIn;
            this._onDidChangeStatus.fire(e);

            return this;
        }
        catch (ex) {
            this.logout();

            throw ex;
        }
    }
}
