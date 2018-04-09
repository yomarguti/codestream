'use strict';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import {
    CodeStreamApi,
    CodeStreamRepositories, CodeStreamRepository, CodeStreamStreams, CodeStreamTeam, CodeStreamTeams,
    LoginResponse,
    Post, Repository, Stream, Team, User
} from './api';

import { Git } from '../git/git';
import { PubNubReceiver } from './pubnub';
import { GitRemote } from '../git/models/remote';

export { Post, Repository, Stream, Team, User } from './api';

function loggedIn(target: CodeStreamSession, propertyName: string, descriptor: TypedPropertyDescriptor<any>) {
    if (typeof descriptor.value === 'function') {
        const method = descriptor.value;
        descriptor.value = function(this: CodeStreamSession) {
            if (!this.loggedIn) throw new Error('Not Logged In');
            return method!.apply(this, arguments);
        };
    }
    else if (typeof descriptor.get === 'function') {
        const get = descriptor.get;
        descriptor.get = function(this: CodeStreamSession) {
            if (!this.loggedIn) throw new Error('Not Logged In');
            return get!.apply(this, arguments);
        };
    }
}

export class CodeStreamSession extends Disposable {

    static async create(serverUri: string): Promise<CodeStreamSession> {
        const api = new CodeStreamApi(serverUri);
        return new CodeStreamSession(api);
    }

    private _onDidChange = new EventEmitter<void>();
    get onDidChange(): Event<void> {
        return this._onDidChange.event;
    }

    public email: string | undefined;

    private _data: LoginResponse | undefined;
    private _disposable: Disposable | undefined;
    private readonly _git: Git;
    private readonly _pubnub: PubNubReceiver;

    private constructor(
        private readonly api: CodeStreamApi
    ) {
        super(() => this.dispose());

        this._git = new Git();
        this._pubnub = new PubNubReceiver();
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    private onGitRepositoriesChanged() {
        this.syncRepositories();
        this._onDidChange.fire();
    }

    get loggedIn() {
        return this._data !== undefined;
    }

    async login(email: string, password: string): Promise<CodeStreamSession> {
        if (this.loggedIn) {
            this.logout();
        }

        this._data = await this.api.login(email, password);

        this._disposable = Disposable.from(
            this._pubnub.initialize(this.token, this.userId, this.pubnubKey),
            this._git.onDidChangeRepositories(this.onGitRepositoriesChanged, this)
        );

        await this.syncRepositories();

        return this;
    }

    logout() {
        this._data = undefined;

        if (this._disposable !== undefined) {
            this._disposable.dispose();
            this._disposable = undefined;
        }
    }

    private _reposByUrl: Map<string, Repository> = new Map();
    getRepositories() {
        return this._reposByUrl.values();
    }

    getRepositoryFromUrl(url: string): Repository | undefined {
        return this._reposByUrl.get(url);
    }

    private async syncRepositories() {
        try {
            const gitRepos = await Git.getRepositories();

            this._reposByUrl.clear();
            let firsts;
            let remoteUrl;
            for (const gr of gitRepos) {
                [firsts, remoteUrl] = await Promise.all([
                    Git.getFirstCommits(gr),
                    Git.getRemoteUri(gr)
                ]);

                if (remoteUrl === undefined || firsts.length === 0) continue;

                const r = await this.api.findRepo(remoteUrl.toString(), firsts);
                if (r.repo === undefined) continue;

                this._reposByUrl.set(r.repo.normalizedUrl, r.repo);
            }
        }
        catch (ex) {
            debugger;
        }
    }

    @loggedIn
    get hasSingleRepo() {
        return this._data!.repos.length === 1;
    }

    @loggedIn
    get hasSingleTeam() {
        return this._data!.teams.length === 1;
    }

    get userId() {
        return this._data!.user.id;
    }

    private get pubnubKey() {
        return this._data!.pubnubKey;
    }

    private get token() {
        return this._data!.accessToken;
    }

    // private get repoIds() {
    //     return this.data!.repos.map(t => t._id);
    // }

    private get teamIds() {
        return this._data!.teams.map(t => t.id);
    }

    @loggedIn
    async createPost(text: string, teamId: string, streamId: string): Promise<Post | undefined> {
        return (await this.api.createPost(this.token, {
            teamId: teamId,
            streamId: streamId,
            text: text
        })).post;
    }

    @loggedIn
    async createRepo(uri: Uri, teamId: string, streamId: string): Promise<Repository | undefined> {
        return (await this.api.createRepo(this.token, {
            teamId: teamId,
            url: uri.toString()
        })).repo;
    }

    @loggedIn
    async createStream(uri: Uri, teamId: string, repoId: string): Promise<Stream | undefined> {
        return (await this.api.createStream(this.token, {
            teamId: teamId,
            repoId: repoId,
            type: 'file',
            file: uri.toString()
        })).stream;
    }

    async getPosts(stream: Stream): Promise<Post[]>;
    async getPosts(streamId: string, teamId: string): Promise<Post[]>;
    @loggedIn
    async getPosts(streamOrStreamId: Stream | string, teamId?: string): Promise<Post[]> {
        let streamId;
        if (typeof streamOrStreamId === 'string') {
            streamId = streamOrStreamId;
        }
        else {
            streamId = streamOrStreamId.id;
            teamId = streamOrStreamId.teamId;
        }
        return (await this.api.getPosts(this.token, teamId!, streamId)).posts;
    }

    async getRepo(repoId: string, team: Team): Promise<Repository | undefined>;
    async getRepo(repoId: string, teamId: string): Promise<Repository | undefined>;
    @loggedIn
    async getRepo(repoId: string, teamOrTeamId: Team | string): Promise<Repository | undefined> {
        let teamId;
        if (typeof teamOrTeamId === 'string') {
            teamId = teamOrTeamId;
        }
        else {
            teamId = teamOrTeamId.id;
        }
        return (await this.api.getRepo(this.token, teamId, repoId)).repo;
    }

    async getRepos(team: Team): Promise<Repository[]>;
    async getRepos(teamId: string): Promise<Repository[]>;
    @loggedIn
    async getRepos(teamOrTeamId: Team | string): Promise<Repository[]> {
        let teamId;
        if (typeof teamOrTeamId === 'string') {
            teamId = teamOrTeamId;
        }
        else {
            teamId = teamOrTeamId.id;
        }
        return (await this.api.getRepos(this.token, teamId)).repos;
    }

    async getStream(streamId: string, repo: Repository): Promise<Stream | undefined>;
    async getStream(streamId: string, repoId: string, teamId: string): Promise<Stream | undefined>;
    @loggedIn
    async getStream(streamId: string, repoOrRepoId: Repository | string, teamId?: string): Promise<Stream | undefined> {
        let repoId;
        if (typeof repoOrRepoId === 'string') {
            repoId = repoOrRepoId;
        }
        else {
            repoId = repoOrRepoId.id;
            teamId = repoOrRepoId.teamId;
        }

        return (await this.api.getStream(this.token, teamId!, repoId, streamId)).stream;
    }

    async getStreams(repo: Repository): Promise<Stream[]>;
    async getStreams(repoId: string, teamId: string): Promise<Stream[]>;
    @loggedIn
    async getStreams(repoOrRepoId: Repository | string, teamId?: string): Promise<Stream[]> {
        let repoId;
        if (typeof repoOrRepoId === 'string') {
            repoId = repoOrRepoId;
        }
        else {
            repoId = repoOrRepoId.id;
            teamId = repoOrRepoId.teamId;
        }
        return (await this.api.getStreams(this.token, teamId!, repoId!)).streams;
    }

    @loggedIn
    async getTeam(teamId: string): Promise<Team | undefined> {
        return (await this.api.getTeam(this.token, teamId)).team;
    }

    @loggedIn
    async getTeams(): Promise<Team[]> {
        return (await this.api.getTeams(this.token, this.teamIds)).teams;
    }

    @loggedIn
    async getUser(userId: string, teamId: string): Promise<User | undefined> {
        return (await this.api.getUser(this.token, teamId, userId)).user;
    }

    @loggedIn
    async getUsers(teamId: string): Promise<User[]> {
        return (await this.api.getUsers(this.token, teamId)).users;
    }

    private _repos: Map<string, CodeStreamRepositories> = new Map();
    async repos(team: CodeStreamTeam) {
        let repos = this._repos.get(team.id);
        if (repos === undefined) {
            repos = new CodeStreamRepositories(this, team);
            this._repos.set(team.id, repos);
        }
        return repos;
    }

    private _streams: Map<string, CodeStreamStreams> = new Map();
    streams(repo: CodeStreamRepository) {
        let streams = this._streams.get(repo.id);
        if (streams === undefined) {
            streams = new CodeStreamStreams(this, repo);
        }
        return streams;
    }

    private _teams: CodeStreamTeams | undefined;
    teams() {
        if (this._teams === undefined) {
            this._teams = new CodeStreamTeams(this);
        }
        return this._teams;
    }
}
