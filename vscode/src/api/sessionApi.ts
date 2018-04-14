'use strict';
import { Range, Uri } from 'vscode';
import {
    CodeStreamApi,
    CSMarkerLocations, CSPost, CSRepository, CSStream, CSTeam, CSUser
} from './api';
import { Container } from '../container';

export class CodeStreamSessionApi {

    constructor(
        private readonly _api: CodeStreamApi,
        private readonly token: string,
        private readonly teamId: string
    ) {
    }

    async createPost(text: string, streamId: string, teamId?: string): Promise<CSPost | undefined> {
        return (await this._api.createPost(this.token, {
            teamId: teamId || this.teamId!,
            streamId: streamId,
            text: text
        })).post;
    }

    async createPostWithCode(text: string, code: string, range: Range, commitHash: string, streamId: string, teamId?: string): Promise<CSPost | undefined> {
        return (await this._api.createPost(this.token, {
            teamId: teamId || this.teamId!,
            streamId: streamId,
            text: text,
            codeBlocks: [{
                code: code,
                location: [
                    range.start.line,
                    range.start.character,
                    range.end.line,
                    range.end.character
                ]
            }],
            commitHashWhenPosted: commitHash
        })).post;
    }

    async createRepo(uri: Uri, firstCommitHashes: string[], teamId?: string): Promise<CSRepository | undefined> {
        return (await this._api.createRepo(this.token, {
            teamId: teamId || this.teamId!,
            url: uri.toString(),
            firstCommitHash: firstCommitHashes[0]
        })).repo;
    }

    async createStream(uri: Uri, repoId: string, teamId?: string): Promise<CSStream | undefined> {
        return (await this._api.createStream(this.token, {
            teamId: teamId || this.teamId!,
            repoId: repoId,
            type: 'file',
            file: uri.fsPath
        })).stream;
    }

    private async findOrRegisterRepo(registeredRepos: CSRepository[], uri: Uri) {
        const [firsts, remote] = await Promise.all([
            Container.git.getFirstCommits(uri),
            Container.git.getRemote(uri)
        ]);

        if (remote === undefined || firsts.length === 0) return undefined;

        const remoteUrl = remote.normalizedUrl;
        const repo = await registeredRepos.find(r => r.normalizedUrl === remoteUrl);
        if (repo !== undefined) return repo;

        return await this.createRepo(remote.uri, firsts);
    }

    async findOrRegisterRepos(): Promise<[Uri, CSRepository][]> {
        const [registeredRepos, repos] = await Promise.all([
            this.getRepos(),
            Container.git.getRepositories()
        ]);

        const items: [Uri, CSRepository][] = [];

        let found;
        for (const repo of repos) {
            found = await this.findOrRegisterRepo(registeredRepos, repo.rootUri);
            if (found === undefined) continue;

            items.push([repo.rootUri, found]);
        }

        return items;
    }

    async getMarkerLocations(commitHash: string, stream: CSStream): Promise<CSMarkerLocations>;
    async getMarkerLocations(commitHash: string, streamId: string, teamId?: string): Promise<CSMarkerLocations>;
    async getMarkerLocations(commitHash: string, streamOrStreamId: CSStream | string, teamId?: string) {
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

    async getPosts(stream: CSStream): Promise<CSPost[]>;
    async getPosts(streamId: string, teamId?: string): Promise<CSPost[]>;
    async getPosts(streamOrStreamId: CSStream | string, teamId?: string): Promise<CSPost[]> {
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

    async getRepo(repoId: string, team?: CSTeam): Promise<CSRepository | undefined>;
    async getRepo(repoId: string, teamId?: string): Promise<CSRepository | undefined>;
    async getRepo(repoId: string, teamOrTeamId?: CSTeam | string): Promise<CSRepository | undefined> {
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

    async getRepos(team?: CSTeam): Promise<CSRepository[]>;
    async getRepos(teamId?: string): Promise<CSRepository[]>;
    async getRepos(teamOrTeamId?: CSTeam | string): Promise<CSRepository[]> {
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

    async getStream(streamId: string, repo: CSRepository): Promise<CSStream | undefined>;
    async getStream(streamId: string, repoId: string, teamId?: string): Promise<CSStream | undefined>;
    async getStream(streamId: string, repoOrRepoId: CSRepository | string, teamId?: string): Promise<CSStream | undefined> {
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

    async getStreams(repo?: CSRepository): Promise<CSStream[]>;
    async getStreams(repoId?: string, teamId?: string): Promise<CSStream[]>;
    async getStreams(repoOrRepoId?: CSRepository | string, teamId?: string): Promise<CSStream[]> {
        let repoId;
        if (repoOrRepoId === undefined) {
            repoId = this.teamId!;
            teamId = this.teamId!;
        }
        else if (typeof repoOrRepoId === 'string') {
            repoId = repoOrRepoId;
            teamId = teamId || this.teamId!;
        }
        else {
            repoId = repoOrRepoId.id;
            teamId = repoOrRepoId.teamId;
        }
        return (await this._api.getStreams(this.token, teamId, repoId!)).streams;
    }

    // async getTeam(teamId: string): Promise<CSTeam | undefined> {
    //     return (await this._api.getTeam(this.token, teamId)).team;
    // }

    // async getTeams(ids: string[]): Promise<CSTeam[]> {
    //     return (await this._api.getTeams(this.token, ids)).teams;
    // }

    async getUser(userId: string, teamId?: string): Promise<CSUser | undefined> {
        return (await this._api.getUser(this.token, teamId || this.teamId!, userId)).user;
    }

    async getUsers(teamId?: string): Promise<CSUser[]> {
        return (await this._api.getUsers(this.token, teamId || this.teamId!)).users;
    }
}
