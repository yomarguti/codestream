'use strict';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import {
    CodeStreamApi,
    CodeStreamRepositories, CodeStreamRepository, CodeStreamStreams, CodeStreamUsers,
    LoginResponse,
    Marker, MarkerLocations, Post, Repository, Stream, Team, User
} from './api';
import { Git } from '../git/git';
import { PubNubReceiver } from './pubnub';
import { GitRemote } from '../git/models/remote';
import { Server } from 'https';
import { Strings } from '../system';

// export { Post, Repository, Stream, Team, User } from './api';
export { CodeStreamRepository, CodeStreamStream, CodeStreamUser } from './api';

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

    private readonly _api: CodeStreamApi;
    private _disposable: Disposable | undefined;
    private readonly _git: Git;
    private readonly _pubnub: PubNubReceiver;

    constructor(
        public readonly serverUrl: string
    ) {
        super(() => this.dispose());

        this._api = new CodeStreamApi(serverUrl);

        this._git = new Git();
        this._pubnub = new PubNubReceiver();
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    private onGitRepositoriesChanged() {
        this._onDidChange.fire();
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

    private _repos: CodeStreamRepositories | undefined;
    @signedIn
    get repos() {
        if (this._repos === undefined) {
            this._repos = new CodeStreamRepositories(this);
        }
        return this._repos;
    }

    private _status: SessionStatus = SessionStatus.SignedOut;
    get status() {
        return this._status;
    }

    get signedIn() {
        return this._status === SessionStatus.SignedIn;
    }

    private _users: CodeStreamUsers | undefined;
    @signedIn
    get users() {
        if (this._users === undefined) {
            this._users = new CodeStreamUsers(this);
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

            this._disposable = Disposable.from(
                this._pubnub.initialize(this.token, this.userId, this.pubnubKey),
                this._git.onDidChangeRepositories(this.onGitRepositoriesChanged, this)
            );

            this._status = SessionStatus.SignedIn;
            this._onDidChangeStatus.fire(e);
            return this;
        }
        catch (ex) {
            this.logout();

            throw ex;
        }
    }

    logout() {
        if (this._id !== undefined) {
            CodeStreamSession._sessions.delete(this._id);
        }

        this._id = undefined;
        this._status = SessionStatus.SignedOut;
        this._onDidChangeStatus.fire({ getStatus: () => this._status });

        if (this._disposable !== undefined) {
            this._disposable.dispose();
            this._disposable = undefined;
        }
    }

    /// API Methods

    @signedIn
    async createPost(text: string, streamId: string, teamId?: string): Promise<Post | undefined> {
        return (await this._api.createPost(this.token, {
            teamId: teamId || this.teamId!,
            streamId: streamId,
            text: text
        })).post;
    }

    @signedIn
    async createRepo(uri: Uri, teamId?: string): Promise<Repository | undefined> {
        return (await this._api.createRepo(this.token, {
            teamId: teamId || this.teamId!,
            url: uri.toString()
        })).repo;
    }

    @signedIn
    async createStream(uri: Uri, repoId: string, teamId?: string): Promise<Stream | undefined> {
        return (await this._api.createStream(this.token, {
            teamId: teamId || this.teamId!,
            repoId: repoId,
            type: 'file',
            file: uri.toString()
        })).stream;
    }

    async getMarkerLocations(commitHash: string, stream: Stream): Promise<MarkerLocations>;
    async getMarkerLocations(commitHash: string, streamId: string, teamId?: string): Promise<MarkerLocations>;
    @signedIn
    async getMarkerLocations(commitHash: string, streamOrStreamId: Stream | string, teamId?: string) {
        let streamId;
        if (typeof streamOrStreamId === 'string') {
            streamId = streamOrStreamId;
            teamId = teamId || this.teamId;
        }
        else {
            streamId = streamOrStreamId.id;
            teamId = streamOrStreamId.teamId;
        }
        return (await this._api.getMarkerLocations(this.token, teamId!, streamId, commitHash)).markerLocations;
    }

    async getPosts(stream: Stream): Promise<Post[]>;
    async getPosts(streamId: string, teamId?: string): Promise<Post[]>;
    @signedIn
    async getPosts(streamOrStreamId: Stream | string, teamId?: string): Promise<Post[]> {
        let streamId;
        if (typeof streamOrStreamId === 'string') {
            streamId = streamOrStreamId;
            teamId = teamId || this.teamId!;
        }
        else {
            streamId = streamOrStreamId.id;
            teamId = streamOrStreamId.teamId;
        }
        return (await this._api.getPosts(this.token, teamId, streamId)).posts;
    }

    async getRepo(repoId: string, team?: Team): Promise<Repository | undefined>;
    async getRepo(repoId: string, teamId?: string): Promise<Repository | undefined>;
    @signedIn
    async getRepo(repoId: string, teamOrTeamId?: Team | string): Promise<Repository | undefined> {
        let teamId;
        if (teamOrTeamId === undefined) {
            teamId = this.teamId!;
        }
        else if (typeof teamOrTeamId === 'string') {
            teamId = teamOrTeamId;
        }
        else {
            teamId = teamOrTeamId.id;
        }
        return (await this._api.getRepo(this.token, teamId, repoId)).repo;
    }

    async getRepos(team?: Team): Promise<Repository[]>;
    async getRepos(teamId?: string): Promise<Repository[]>;
    @signedIn
    async getRepos(teamOrTeamId?: Team | string): Promise<Repository[]> {
        let teamId;
        if (teamOrTeamId === undefined) {
            teamId = this.teamId!;
        }
        else if (typeof teamOrTeamId === 'string') {
            teamId = teamOrTeamId;
        }
        else {
            teamId = teamOrTeamId.id;
        }
        return (await this._api.getRepos(this.token, teamId)).repos;
    }

    async getStream(streamId: string, repo: Repository): Promise<Stream | undefined>;
    async getStream(streamId: string, repoId: string, teamId?: string): Promise<Stream | undefined>;
    @signedIn
    async getStream(streamId: string, repoOrRepoId: Repository | string, teamId?: string): Promise<Stream | undefined> {
        let repoId;
        if (typeof repoOrRepoId === 'string') {
            repoId = repoOrRepoId;
            teamId = teamId || this.teamId!;
        }
        else {
            repoId = repoOrRepoId.id;
            teamId = repoOrRepoId.teamId;
        }

        return (await this._api.getStream(this.token, teamId, repoId, streamId)).stream;
    }

    async getStreams(repo: Repository): Promise<Stream[]>;
    async getStreams(repoId: string, teamId?: string): Promise<Stream[]>;
    @signedIn
    async getStreams(repoOrRepoId: Repository | string, teamId?: string): Promise<Stream[]> {
        let repoId;
        if (typeof repoOrRepoId === 'string') {
            repoId = repoOrRepoId;
            teamId = teamId || this.teamId!;
        }
        else {
            repoId = repoOrRepoId.id;
            teamId = repoOrRepoId.teamId;
        }
        return (await this._api.getStreams(this.token, teamId, repoId!)).streams;
    }

    // async getTeam(teamId: string): Promise<Team | undefined> {
    //     return (await this._api.getTeam(this.token, teamId)).team;
    // }

    // async getTeams(ids: string[]): Promise<Team[]> {
    //     return (await this._api.getTeams(this.token, ids)).teams;
    // }

    @signedIn
    async getUser(userId: string, teamId?: string): Promise<User | undefined> {
        return (await this._api.getUser(this.token, teamId || this.teamId!, userId)).user;
    }

    @signedIn
    async getUsers(teamId?: string): Promise<User[]> {
        return (await this._api.getUsers(this.token, teamId || this.teamId!)).users;
    }
}
