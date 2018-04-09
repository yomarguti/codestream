'use strict';

export interface Entity {
    deactivated: boolean;
    createdAt: Date;
    modifiedAt: Date;
    id: string;
    creatorId: string;
}

export interface Post extends Entity {
    streamId: string;
    text: string;
    repoId: string;
    teamId: string;
    seqNum: number;
}

export interface Repository extends Entity {
    url: string;
    firstCommitHash: string;
    normalizedUrl: string;
    teamId: string;
    companyId: string;
}

export interface Stream extends Entity {
    teamId: string;
    type: 'file' | string;
    file: string;
    repoId: string;
    sortId: string;
}

export interface Team extends Entity {
    name: string;
    primaryReferral: 'internal' | 'external';
    memberIds: string[];
    creatorId: string;
    companyId: string;
}

export interface User extends Entity {
    username: string;
    email: string;
    isRegistered: boolean;
    registeredAt: Date;
    joinMethod: string; // 'Create Team'
    primaryReferral: 'internal' | 'external';
    originTeamId: string;
    companyIds: string[];
    teamIds: string[];
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    user: User;
    accessToken: string;
    pubnubKey: string;
    teams: Team[];
    repos: Repository[];
}

export interface CreatePostRequest {
    teamId: string;
    streamId: string;
    parentPostId?: string;
    text: string;
}

export interface CreatePostResponse {
    post: Post;
}

export interface CreateRepoRequest {
    teamId: string;
    url: string;
}

export interface CreateRepoResponse {
    repo: Repository;
}

export interface CreateStreamRequest {
    teamId: string;
    repoId: string;
    type: 'file' | string;
    file: string;
}

export interface CreateStreamResponse {
    stream: Stream;
}

export interface FindRepoResponse {
    repo?: Repository;
    usernames?: string[];
}

export interface GetPostsResponse {
    posts: Post[];
}

export interface GetRepoResponse {
    repo: Repository;
}

export interface GetReposResponse {
    repos: Repository[];
}

export interface GetStreamResponse {
    stream: Stream;
}

export interface GetStreamsResponse {
    streams: Stream[];
}

export interface GetTeamResponse {
    team: Team;
}

export interface GetTeamsResponse {
    teams: Team[];
}

export interface GetUserResponse {
    user: User;
}

export interface GetUsersResponse {
    users: User[];
}