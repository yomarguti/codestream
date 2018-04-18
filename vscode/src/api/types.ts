'use strict';

export interface CSEntity {
    deactivated?: boolean;
    createdAt: Date;
    modifiedAt: Date;
    _id: string;
    creatorId: string;
}

export interface CSMarker {
    id: string;
    teamId: string;
    streamId: string;
    postId: string;
}

export interface CSMarkerLocations {
    teamId: string;
    streamId: string;
    commitHash: string;
    locations: { [id: string]: [number, number, number, number] };
}

export interface CSPost extends CSEntity {
    streamId: string;
    text: string;
    codeBlocks?: {
        code: string;
        markerId: string;
    }[];
    commitHashWhenPosted?: string;
    repoId: string;
    teamId: string;
    seqNum: number;

}

export interface CSRepository extends CSEntity {
    url: string;
    firstCommitHash: string;
    normalizedUrl: string;
    teamId: string;
    companyId: string;
}

export interface CSStream extends CSEntity {
    teamId: string;
    type: 'file' | string;
    file: string;
    repoId: string;
    sortId: string;
}

export interface CSTeam extends CSEntity {
    name: string;
    primaryReferral: 'internal' | 'external';
    memberIds: string[];
    creatorId: string;
    companyId: string;
}

export interface CSUser extends CSEntity {
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
    user: CSUser;
    accessToken: string;
    pubnubKey: string;
    teams: CSTeam[];
    repos: CSRepository[];
}

export interface CreatePostRequest {
    teamId: string;
    streamId: string;
    parentPostId?: string;
    text: string;
    codeBlocks?: {
        code: string;
        location: [number, number, number, number];
    }[];
    commitHashWhenPosted?: string;
}

export interface CreatePostResponse {
    post: CSPost;
}

export interface CreateRepoRequest {
    teamId: string;
    url: string;
    firstCommitHash: string;
}

export interface CreateRepoResponse {
    repo: CSRepository;
}

export interface CreateStreamRequest {
    teamId: string;
    repoId: string;
    type: 'file' | string;
    file: string;
}

export interface CreateStreamResponse {
    stream: CSStream;
}

export interface FindRepoResponse {
    repo?: CSRepository;
    usernames?: string[];
}

export interface GetMarkerLocationsResponse {
    markerLocations: CSMarkerLocations;
}

export interface GetMarkerResponse {
    marker: CSMarker;
}

export interface GetMarkersResponse {
    markers: CSMarker[];
    numMarkers: number;
}

export interface GetPostsResponse {
    posts: CSPost[];
}

export interface GetRepoResponse {
    repo: CSRepository;
}

export interface GetReposResponse {
    repos: CSRepository[];
}

export interface GetStreamResponse {
    stream: CSStream;
}

export interface GetStreamsResponse {
    streams: CSStream[];
}

export interface GetTeamResponse {
    team: CSTeam;
}

export interface GetTeamsResponse {
    teams: CSTeam[];
}

export interface GetUserResponse {
    user: CSUser;
}

export interface GetUsersResponse {
    users: CSUser[];
}