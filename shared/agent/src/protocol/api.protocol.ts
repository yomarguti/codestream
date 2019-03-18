"use strict";
import {
	ChannelServiceType,
	CodemarkType,
	CSChannelStream,
	CSCodemark,
	CSCompany,
	CSDirectStream,
	CSFileStream,
	CSLocationArray,
	CSMarker,
	CSMarkerLocation,
	CSMarkerLocations,
	CSMe,
	CSPost,
	CSRepository,
	CSStream,
	CSTeam,
	CSUser,
	ProviderType,
	StreamType
} from "./api.protocol.models";

export * from "./api.protocol.models";

export enum ApiErrors {
	InvalidCredentials = "INVALID_CREDENTIALS",
	InvalidToken = "TOKEN_INVALID",
	NotConfirmed = "NOT_CONFIRMED",
	NotOnTeam = "USER_NOT_ON_TEAM",
	NotFound = "NOT_FOUND",
	Unknown = "UNKNOWN",
	VersionUnsupported = "VERSION_UNSUPPORTED"
}

export enum LoginResult {
	Success = "SUCCESS",
	InvalidCredentials = "INVALID_CREDENTIALS",
	InvalidToken = "TOKEN_INVALID",
	NotConfirmed = "NOT_CONFIRMED",
	NotOnTeam = "USER_NOT_ON_TEAM",
	Unknown = "UNKNOWN",
	VersionUnsupported = "VERSION_UNSUPPORTED"
}

export interface CSCompleteSignupRequest {
	token: string;
}

export interface CSLoginRequest {
	email: string;
	password?: string;
	token?: string;
}

export interface CSLoginResponse {
	user: CSMe;
	accessToken: string;
	pubnubKey: string;
	pubnubToken: string;
	teams: CSTeam[];
	companies: CSCompany[];
	repos: CSRepository[];
}

export interface CSCreateMarkerLocationRequest {
	teamId: string;
	streamId: string;
	commitHash: string;
	locations: {
		[id: string]: CSLocationArray;
	};
}

export interface CSCreateMarkerLocationResponse {}

export interface CSCreatePostRequestCodeBlock {
	code: string;
	preContext?: string;
	postContext?: string;

	location?: CSLocationArray;
	commitHash?: string;

	streamId?: string;
	file?: string;

	repoId?: string;
	remotes?: string[];
}

export interface CSCreatePostRequestStream {
	teamId: string;
	type: StreamType.File;
	repoId?: string;
	file: string;
}

export interface CSCreatePostRequest {
	teamId: string;
	streamId?: string;
	stream?: CSCreatePostRequestStream;
	parentPostId?: string;
	text: string;
	codeBlocks?: CSCreatePostRequestCodeBlock[];
	commitHashWhenPosted?: string;
	mentionedUserIds?: string[];
	title?: string;
	type?: string;
	assignees?: [];
	color?: string;
}

export interface CSCreatePostResponse {
	post: CSPost;
	codemarks?: CSCodemark[];
	markers?: CSMarker[];
	markerLocations?: CSMarkerLocations[];
	streams?: CSStream[];
	repos?: CSRepository[];
}

export interface CSCreateRepoRequest {
	teamId: string;
	url: string;
	knownCommitHashes: string[];
}

export interface CSCreateRepoResponse {
	repo: CSRepository;
}

export interface CSCreateChannelStreamRequest {
	teamId: string;
	type: StreamType.Channel;
	name: string;
	memberIds?: string[];
	isTeamStream: boolean;
	privacy: "public" | "private";
	purpose?: string;
	serviceType?: ChannelServiceType.Vsls;
	serviceKey?: string;
	serviceInfo?: { [key: string]: any };
}

export interface CSCreateChannelStreamResponse {
	stream: CSChannelStream;
}

export interface CSCreateDirectStreamRequest {
	teamId: string;
	type: StreamType.Direct;
	memberIds: string[];
}

export interface CSCreateDirectStreamResponse {
	stream: CSDirectStream;
}

export interface CSCreateFileStreamRequest {
	teamId: string;
	repoId: string;
	type: StreamType.File;
	file: string;
}

export interface CSCreateFileStreamResponse {
	stream: CSFileStream;
}

export type CSCreateStreamRequest =
	| CSCreateChannelStreamRequest
	| CSCreateDirectStreamRequest
	| CSCreateFileStreamRequest;

export type CSCreateStreamResponse =
	| CSCreateChannelStreamResponse
	| CSCreateDirectStreamResponse
	| CSCreateFileStreamResponse;

export interface CSDeletePostResponse {
	posts: any[];
	codemarks: any[];
	markers: any[];
}

export interface CSDeleteTeamContentRequest {
	teamId: string;
	includeStreams?: boolean;
	newerThan?: number;
}

export interface CSDeleteTeamContentResponse {}

export interface CSEditPostRequest {
	text: string;
	mentionedUserIds?: string[];
}

export interface CSEditPostResponse {
	post: { [key: string]: any };
}

export interface CSReactions {
	[emoji: string]: boolean;
}

export interface CSReactToPostRequest {
	emojis: CSReactions;
}

export interface CSReactToPostResponse {
	post: { [key: string]: any };
}

export interface CSSetPostStatusRequest {
	status: string;
}

export interface CSSetPostStatusResponse {
	post: { [key: string]: any };
}

export interface CSMarkPostUnreadRequest {}

export interface CSMarkPostUnreadResponse {}

export interface CSSetCodemarkPinnedRequest {}

export interface CSSetCodemarkPinnedResponse {}

export interface CSFindRepoResponse {
	repo?: CSRepository;
	usernames?: string[];
}

export interface CSGetMarkerLocationsResponse {
	markerLocations: CSMarkerLocations;
}

export interface CSGetMarkerResponse {
	marker: CSMarker;
}

export interface CSGetMarkersRequest {
	streamId: string;
	teamId: string;
	commitHash?: string;
	markerIds?: string[];
}

export interface CSGetMarkersResponse {
	markers: CSMarker[];
	markerLocations: CSMarkerLocation[];
	codemarks: CSCodemark[];
}

export interface CSGetPostResponse {
	post: CSPost;
}

export interface CSGetPostsResponse {
	posts: CSPost[];
	codemarks?: CSCodemark[];
	markers?: CSMarker[];
	more?: boolean;
}

export interface CSGetRepoResponse {
	repo: CSRepository;
}

export interface CSGetReposResponse {
	repos: CSRepository[];
}

export interface CSGetStreamResponse<T extends CSStream> {
	stream: T;
}

export interface CSGetStreamsResponse<T extends CSStream> {
	streams: T[];
}

export interface CSGetTeamResponse {
	team: CSTeam;
}

export interface CSGetTeamsResponse {
	teams: CSTeam[];
}

export interface CSGetUserResponse {
	user: CSUser;
}

export interface CSGetUsersResponse {
	users: CSUser[];
}

export interface CSInviteUserRequest {
	email: string;
	teamId: string;
	fullName?: string;
}

export interface CSInviteUserResponse {
	user: CSUser;
}

export interface CSJoinStreamRequest {}

export interface CSJoinStreamResponse {
	stream: { [key: string]: any };
}

export interface CSGetMeResponse {
	user: CSMe;
}

export enum CSPresenceStatus {
	Online = "online",
	Away = "away"
}

export interface CSCreateCodemarkRequest {
	teamId: string;
	providerType?: ProviderType;
	type: CodemarkType;
	streamId?: string;
	postId?: string;
	color?: string;
	status?: string;
	title?: string;
	assignees?: string[];
	markers?: CSCreateCodemarkRequestMarker[];
	remotes?: string[];
	externalProvider?: string;
	externalProviderUrl?: string;
	externalAssignees?: { displayName: string }[];
	remoteCodeUrl?: string;
	threadUrl?: string;
	createPermalink?: boolean;
}
export interface CSCreateCodemarkRequestMarker {
	code: string;
	remotes?: string[];
	file?: string;
	commitHash?: string;
	location?: CSLocationArray;
}
export interface CSCreateCodemarkResponse {
	codemark: CSCodemark;
	markers?: CSMarker[];
	markerLocations?: CSMarkerLocations[];
	streams?: CSStream[];
	repos?: CSRepository[];
	permalink?: string;
}

export interface CSGetCodemarkRequest {
	codemarkId: string;
}
export interface CSGetCodemarkResponse {
	codemark: CSCodemark;
	post: CSPost;
	markers: CSMarker[];
}

export interface CSUpdateCodemarkRequest {
	streamId?: string;
	postId?: string;
}
export interface CSUpdateCodemarkResponse {
	codemark: CSCodemark;
}

export interface CSDeleteCodemarkRequest {
	codemarkId: string;
}
export interface CSDeleteCodemarkResponse {}

export interface CSUpdateMarkerRequest {
	commitHashWhenCreated?: string;
}

export interface CSUpdateMarkerResponse {
	marker: CSMarker;
}

export interface CSUpdatePresenceRequest {
	sessionId: string;
	status: CSPresenceStatus;
}

export interface CSUpdatePresenceResponse {
	awayTimeout: number;
}

export interface CSUpdateStreamRequest {
	name?: string;
	purpose?: string;
	isArchived?: boolean;
	$push?: {
		memberIds: string[];
	};
	$pull?: {
		memberIds: string[];
	};
}

export interface CSUpdateStreamResponse {
	stream: { [key: string]: any };
}

export interface CSTrackSlackPostRequest {
	teamId: string;
	streamId: string;
	postId: string;
	parentPostId?: string;
}

export interface CSGetTelemetryKeyResponse {
	key: string;
}
