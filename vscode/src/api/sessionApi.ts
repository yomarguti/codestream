// 'use strict';
// import { Disposable, Event, EventEmitter, Uri } from 'vscode';
// import {
//     CodeStreamApi,
//     CodeStreamRepositories, CodeStreamRepository, CodeStreamStreams, CodeStreamTeam, CodeStreamTeams,
//     LoginResponse,
//     Marker, MarkerLocations, Post, Repository, Stream, Team, User
// } from './api';

// export class CodeStreamSessionApi {

//     private readonly api: CodeStreamApi;

//     constructor(
//         serverUrl: string
//     ) {
//         this.api = new CodeStreamApi(serverUrl);
//     }

//     private _token: string | undefined;
//     private get token(): string {
//         return this._token!;
//     }

//     async login(email: string, password: string): Promise<LoginResponse> {
//         const resp = await this.api.login(email, password);
//         this._token = resp.accessToken;
//         return resp;
//     }

//     findRepo(url: string, firstCommitHashes: string[]) {
//         return this.api.findRepo(url, firstCommitHashes);
//     }

//     async createPost(text: string, teamId: string, streamId: string): Promise<Post | undefined> {
//         return (await this.api.createPost(this.token, {
//             teamId: teamId,
//             streamId: streamId,
//             text: text
//         })).post;
//     }

//     async createRepo(uri: Uri, teamId: string, streamId: string): Promise<Repository | undefined> {
//         return (await this.api.createRepo(this.token, {
//             teamId: teamId,
//             url: uri.toString()
//         })).repo;
//     }

//     async createStream(uri: Uri, teamId: string, repoId: string): Promise<Stream | undefined> {
//         return (await this.api.createStream(this.token, {
//             teamId: teamId,
//             repoId: repoId,
//             type: 'file',
//             file: uri.toString()
//         })).stream;
//     }

//     async getMarkerLocations(commitHash: string, stream: Stream): Promise<MarkerLocations>;
//     async getMarkerLocations(commitHash: string, streamId: string, teamId: string): Promise<MarkerLocations>;
//     async getMarkerLocations(commitHash: string, streamOrStreamId: Stream | string, teamId?: string) {
//         let streamId;
//         if (typeof streamOrStreamId === 'string') {
//             streamId = streamOrStreamId;
//         }
//         else {
//             streamId = streamOrStreamId.id;
//             teamId = streamOrStreamId.teamId;
//         }
//         return (await this.api.getMarkerLocations(this.token, teamId!, streamId, commitHash)).markerLocations;
//     }

//     async getPosts(stream: Stream): Promise<Post[]>;
//     async getPosts(streamId: string, teamId: string): Promise<Post[]>;
//     async getPosts(streamOrStreamId: Stream | string, teamId?: string): Promise<Post[]> {
//         let streamId;
//         if (typeof streamOrStreamId === 'string') {
//             streamId = streamOrStreamId;
//         }
//         else {
//             streamId = streamOrStreamId.id;
//             teamId = streamOrStreamId.teamId;
//         }
//         return (await this.api.getPosts(this.token, teamId!, streamId)).posts;
//     }

//     async getRepo(repoId: string, team: Team): Promise<Repository | undefined>;
//     async getRepo(repoId: string, teamId: string): Promise<Repository | undefined>;
//     async getRepo(repoId: string, teamOrTeamId: Team | string): Promise<Repository | undefined> {
//         let teamId;
//         if (typeof teamOrTeamId === 'string') {
//             teamId = teamOrTeamId;
//         }
//         else {
//             teamId = teamOrTeamId.id;
//         }
//         return (await this.api.getRepo(this.token, teamId, repoId)).repo;
//     }

//     async getRepos(team: Team): Promise<Repository[]>;
//     async getRepos(teamId: string): Promise<Repository[]>;
//     async getRepos(teamOrTeamId: Team | string): Promise<Repository[]> {
//         let teamId;
//         if (typeof teamOrTeamId === 'string') {
//             teamId = teamOrTeamId;
//         }
//         else {
//             teamId = teamOrTeamId.id;
//         }
//         return (await this.api.getRepos(this.token, teamId)).repos;
//     }

//     async getStream(streamId: string, repo: Repository): Promise<Stream | undefined>;
//     async getStream(streamId: string, repoId: string, teamId: string): Promise<Stream | undefined>;
//     async getStream(streamId: string, repoOrRepoId: Repository | string, teamId?: string): Promise<Stream | undefined> {
//         let repoId;
//         if (typeof repoOrRepoId === 'string') {
//             repoId = repoOrRepoId;
//         }
//         else {
//             repoId = repoOrRepoId.id;
//             teamId = repoOrRepoId.teamId;
//         }

//         return (await this.api.getStream(this.token, teamId!, repoId, streamId)).stream;
//     }

//     async getStreams(repo: Repository): Promise<Stream[]>;
//     async getStreams(repoId: string, teamId: string): Promise<Stream[]>;
//     async getStreams(repoOrRepoId: Repository | string, teamId?: string): Promise<Stream[]> {
//         let repoId;
//         if (typeof repoOrRepoId === 'string') {
//             repoId = repoOrRepoId;
//         }
//         else {
//             repoId = repoOrRepoId.id;
//             teamId = repoOrRepoId.teamId;
//         }
//         return (await this.api.getStreams(this.token, teamId!, repoId!)).streams;
//     }

//     async getTeam(teamId: string): Promise<Team | undefined> {
//         return (await this.api.getTeam(this.token, teamId)).team;
//     }

//     async getTeams(ids: string[]): Promise<Team[]> {
//         return (await this.api.getTeams(this.token, ids)).teams;
//     }

//     async getUser(userId: string, teamId: string): Promise<User | undefined> {
//         return (await this.api.getUser(this.token, teamId, userId)).user;
//     }

//     async getUsers(teamId: string): Promise<User[]> {
//         return (await this.api.getUsers(this.token, teamId)).users;
//     }
// }
