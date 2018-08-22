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
	postStreamId: string;
	commitHashWhenCreated: string;
	deactivated: boolean;
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
	// locations: Map<string, CSLocationArray>;
	locations: { [id: string]: CSLocationArray };
}

export interface CSMarkerLocation {
	id: string;
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
	teamId: string;
	streamId: string;
	repoId: string;
	seqNum: number;
	text: string;
	codeBlocks?: CSCodeBlock[];
	commitHashWhenPosted?: string;
	hasBeenEdited: boolean;
	hasReplies: boolean;
	mentionedUserIds: string[];
	origin: "email" | "slack" | "teams";
	parentPostId?: string;
}

export interface CSRemote {
	url: string;
	normalizedUrl: string;
	companyIdentifier: string;
}

export interface CSRepository extends CSEntity {
	name: string;
	remotes: CSRemote[];
	teamId: string;
}

export enum StreamType {
	Channel = "channel",
	Direct = "direct",
	File = "file"
}

export interface CSChannelStream extends CSEntity {
	isArchived: boolean;
	privacy: "public" | "private";
	sortId: string;
	teamId: string;
	mostRecentPostCreatedAt?: number;
	mostRecentPostId?: string;
	purpose?: string;

	type: StreamType.Channel;
	name: string;
	memberIds?: string[];
	isTeamStream: boolean;
}

export interface CSDirectStream extends CSEntity {
	isArchived: boolean;
	privacy: "public" | "private";
	sortId: string;
	teamId: string;
	mostRecentPostCreatedAt?: number;
	mostRecentPostId?: string;
	purpose?: string;

	type: StreamType.Direct;
	name?: string;
	memberIds: string[];
}

export interface CSFileStream extends CSEntity {
	isArchived: boolean;
	privacy: "public" | "private";
	sortId: string;
	teamId: string;
	mostRecentPostCreatedAt?: number;
	mostRecentPostId?: string;
	purpose?: string;

	type: StreamType.File;
	file: string;
	repoId: string;
	numMarkers: number;
	editingUsers?: any;
}

export type CSStream = CSChannelStream | CSDirectStream | CSFileStream;

export interface CSTeam extends CSEntity {
	companyId: string;
	memberIds: string[];
	name: string;
	primaryReferral: "internal" | "external";
	integrations?: { [key: string]: { enabled: boolean } };
}

export interface CSUser extends CSEntity {
	companyIds: string[];
	email: string;
	firstName: string;
	fullName: string;
	isRegistered: boolean;
	lastName: string;
	lastPostCreatedAt: number;
	numMentions: number;
	numInvites: number;
	registeredAt: number;
	teamIds: string[];
	timeZone: string;
	totalPosts: number;
	username: string;

	lastReads?: {
		[streamId: string]: number;
	};
	preferences?: any;
	secondaryEmails?: string[];

	// joinMethod: string; // 'Create Team'
	// primaryReferral: "internal" | "external";
	// originTeamId: string;
}

export interface LoginRequest {
	email: string;
	password?: string;
	token?: string;
}

export interface CompleteSignupRequest {
	token: string;
}

export interface LoginResponse {
	user: CSUser;
	accessToken: string;
	pubnubKey: string;
	pubnubToken: string;
	teams: CSTeam[];
	repos: CSRepository[];
}

export enum ApiErrors {
	InvalidCredentials = "INVALID_CREDENTIALS",
	InvalidToken = "TOKEN_INVALID",
	NotConfirmed = "NOT_CONFIRMED",
	NotOnTeam = "USER_NOT_ON_TEAM",
	NotFound = "NOT_FOUND",
	Unknown = "UNKNOWN"
}

export enum LoginResult {
	Success = "SUCCESS",
	InvalidCredentials = "INVALID_CREDENTIALS",
	InvalidToken = "TOKEN_INVALID",
	NotConfirmed = "NOT_CONFIRMED",
	NotOnTeam = "USER_NOT_ON_TEAM",
	Unknown = "UNKNOWN"
}

export interface CreateMarkerLocationRequest {
	teamId: string;
	streamId: string;
	commitHash: string;
	locations: {
		[id: string]: CSLocationArray;
	};
}

export interface CreateMarkerLocationResponse {}

export interface CreatePostRequestCodeBlock {
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

export interface CreatePostRequestStream {
	teamId: string;
	type: StreamType.File;
	repoId?: string;
	file: string;
}

export interface CreatePostRequest {
	teamId: string;
	streamId?: string;
	stream?: CreatePostRequestStream;
	parentPostId?: string;
	text: string;
	codeBlocks?: CreatePostRequestCodeBlock[];
	commitHashWhenPosted?: string;
	mentionedUserIds?: string[];
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

export interface EditPostRequest {
	id: string;
	text: string;
	mentionedUserIds: string[];
}

export interface EditPostResponse extends DeletePostResponse {}

export interface MarkPostUnreadRequest {
	id: string;
}

export interface MarkPostUnreadResponse extends DeletePostResponse {}

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

export interface InviteRequest {
	email: string;
	teamId: string;
	fullName?: string;
}

export interface InviteResponse {
	user: CSUser;
}

export interface JoinStreamRequest {}

export interface JoinStreamResponse {
	stream: CSStream;
}

export interface MeResponse {
	user: CSUser;
}

export enum PresenceStatus {
	Online = "online",
	Away = "away"
}

export interface UpdateMarkerRequest {
	commitHashWhenCreated?: string;
}

export interface UpdateMarkerResponse {
	marker: CSMarker;
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
