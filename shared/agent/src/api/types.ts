"use strict";

export interface CSEntity {
	deactivated?: boolean;
	createdAt: number;
	modifiedAt: Date;
	id: string;
	creatorId: string;
}

export interface CSMarker {
	id: string;
	teamId: string;
	streamId: string;
	postId: string;
	commitHashWhenCreated: string;
}

export interface CSLocationMeta {
	startWasDeleted?: boolean;
	endWasDeleted?: boolean;
	entirelyDeleted?: boolean;
}

export type CSLocationArray = [number, number, number, number, CSLocationMeta | undefined];

export interface CSMarkerLocations {
	teamId: string;
	streamId: string;
	commitHash: string;
	locations: Map<string, CSLocationArray>;
	// locations: { [id: string]: CSLocationArray };
}

export interface CSMarkerLocation {
	lineStart: number;
	colStart: number;
	lineEnd: number;
	colEnd: number;
	meta?: CSLocationMeta;
}

export interface CSCodeBlock {
	code: string;
	markerId: string;
	file: string;
	repoId: string;
	streamId?: string;
}

export interface CSPost extends CSEntity {
	streamId: string;
	text: string;
	codeBlocks?: CSCodeBlock[];
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

export enum StreamType {
	Channel = "channel",
	Direct = "direct",
	File = "file"
}

export interface CSChannelStream extends CSEntity {
	teamId: string;
	type: StreamType.Channel;
	name: string;
	memberIds?: string[];
	sortId: string;
	isTeamStream: boolean;
	mostRecentPostId?: string;
	privacy: "public" | "private";
}

export interface CSDirectStream extends CSEntity {
	teamId: string;
	type: StreamType.Direct;
	name?: string;
	memberIds: string[];
	sortId: string;
	mostRecentPostId?: string;
	privacy: "public" | "private";
}

export interface CSFileStream extends CSEntity {
	teamId: string;
	type: StreamType.File;
	file: string;
	repoId: string;
	sortId: string;
	mostRecentPostId?: string;
	privacy: "public" | "private";
}

export type CSStream = CSChannelStream | CSDirectStream | CSFileStream;

export interface CSTeam extends CSEntity {
	name: string;
	primaryReferral: "internal" | "external";
	memberIds: string[];
	creatorId: string;
	companyId: string;
}

export interface CSUser extends CSEntity {
	username: string;
	email: string;
	firstName: string;
	lastName: string;
	isRegistered: boolean;
	registeredAt: Date;
	timeZone: string;
	joinMethod: string; // 'Create Team'
	primaryReferral: "internal" | "external";
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

export interface CreatePostRequestCodeBlock {
	code: string;
	location: [number, number, number, number];
	streamId?: string;
	file?: string;
	repoId?: string;
}

export interface CreatePostRequest {
	teamId: string;
	streamId: string;
	parentPostId?: string;
	text: string;
	codeBlocks?: CreatePostRequestCodeBlock[];
	commitHashWhenPosted?: string;
}

export interface CreatePostResponse {
	post: CSPost;
}

export interface CreateRepoRequest {
	teamId: string;
	url: string;
	knownCommitHashes: string[];
}

export interface CreateRepoResponse {
	repo: CSRepository;
}

export interface CreateChannelStreamRequest {
	teamId: string;
	type: StreamType.Channel;
	name: string;
	memberIds?: string[];
	isTeamStream: boolean;
	privacy: "public" | "private";
}

export interface CreateDirectStreamRequest {
	teamId: string;
	type: StreamType.Direct;
	memberIds: string[];
}

export interface CreateFileStreamRequest {
	teamId: string;
	repoId: string;
	type: StreamType.File;
	file: string;
}

export type CreateStreamRequest =
	| CreateChannelStreamRequest
	| CreateDirectStreamRequest
	| CreateFileStreamRequest;

export interface CreateStreamResponse {
	stream: CSStream;
}

export interface DeletePostResponse {
	post: CSPost;
}

export interface DeleteTeamContentRequest {
	teamId: string;
	includeStreams?: boolean;
	newerThan?: number;
}

export interface DeleteTeamContentResponse {}

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

export interface GetPostResponse {
	post: CSPost;
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

export interface GetStreamResponse<T extends CSStream> {
	stream: T;
}

export interface GetStreamsResponse<T extends CSStream> {
	streams: T[];
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

export interface JoinStreamRequest {}

export interface JoinStreamResponse {
	stream: CSStream;
}

export enum PresenceStatus {
	Online = "online",
	Away = "away"
}

export interface UpdatePresenceRequest {
	sessionId: string;
	status: PresenceStatus;
}

export interface UpdatePresenceResponse {
	awayTimeout: number;
}

export interface UpdateStreamMembershipRequest {
	$push: string;
}

export interface UpdateStreamMembershipResponse {
	stream: CSStream;
}
