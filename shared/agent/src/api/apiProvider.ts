import { RequestInit, Response } from "node-fetch";
import { Disposable, Event } from "vscode-languageserver";
import {
	SetStreamPurposeRequest,
	SetStreamPurposeResponse,
	AccessToken,
	CreateChannelStreamRequest,
	CreateChannelStreamResponse,
	CreateDirectStreamRequest,
	CreateDirectStreamResponse,
	CreateMarkerLocationRequest,
	CreateMarkerLocationResponse,
	CreatePostRequest,
	CreatePostResponse,
	CreateRepoRequest,
	CreateRepoResponse,
	CSUnreads,
	DeletePostRequest,
	DeletePostResponse,
	EditPostRequest,
	EditPostResponse,
	FetchFileStreamsRequest,
	FetchFileStreamsResponse,
	FetchMarkerLocationsRequest,
	FetchMarkerLocationsResponse,
	FetchMarkersRequest,
	FetchMarkersResponse,
	FetchPostRepliesRequest,
	FetchPostRepliesResponse,
	FetchPostsRequest,
	FetchPostsResponse,
	FetchReposRequest,
	FetchReposResponse,
	FetchStreamsRequest,
	FetchStreamsResponse,
	FetchTeamsRequest,
	FetchTeamsResponse,
	FetchUnreadStreamsRequest,
	FetchUnreadStreamsResponse,
	FetchUsersRequest,
	FetchUsersResponse,
	GetMarkerRequest,
	GetMarkerResponse,
	GetMeResponse,
	GetPostRequest,
	GetPostResponse,
	GetRepoRequest,
	GetRepoResponse,
	GetStreamRequest,
	GetStreamResponse,
	GetTeamRequest,
	GetTeamResponse,
	GetUnreadsRequest,
	GetUnreadsResponse,
	GetUserRequest,
	GetUserResponse,
	InviteUserRequest,
	InviteUserResponse,
	JoinStreamRequest,
	JoinStreamResponse,
	LeaveStreamRequest,
	LeaveStreamResponse,
	MarkPostUnreadRequest,
	MarkPostUnreadResponse,
	MarkStreamReadRequest,
	MarkStreamReadResponse,
	ReactToPostRequest,
	ReactToPostResponse,
	UpdateMarkerRequest,
	UpdateMarkerResponse,
	UpdatePreferencesRequest,
	UpdatePresenceRequest,
	UpdatePresenceResponse,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse,
	UpdateStreamRequest,
	UpdateStreamResponse
} from "../shared/agent.protocol";
import {
	CSChannelStream,
	CSDirectStream,
	CSMarker,
	CSMarkerLocations,
	CSPost,
	CSRepository,
	CSTeam,
	CSUser,
	LoginResponse
} from "../shared/api.protocol";

interface BasicLoginOptions {
	team?: string;
	teamId?: string;
}

export interface CredentialsLoginOptions extends BasicLoginOptions {
	type: "credentials";
	email: string;
	password: string;
}

export interface OneTimeCodeLoginOptions extends BasicLoginOptions {
	type: "otc";
	code: string;
}

export interface TokenLoginOptions extends BasicLoginOptions {
	type: "token";
	token: AccessToken;
}

export type LoginOptions = CredentialsLoginOptions | OneTimeCodeLoginOptions | TokenLoginOptions;

export enum MessageType {
	Connection = "connection",
	MarkerLocations = "markerLocations",
	Markers = "markers",
	Posts = "posts",
	Repositories = "repos",
	Streams = "streams",
	Teams = "teams",
	Unreads = "unreads",
	Users = "users"
}

export enum ConnectionStatus {
	Disconnected = "disconnected",
	Reconnected = "reconnected",
	Reconnecting = "reconnecting"
}

export interface ConnectionRTMessage {
	type: MessageType.Connection;
	data: { status: ConnectionStatus };
}

export interface MarkerLocationsRTMessage {
	type: MessageType.MarkerLocations;
	data: CSMarkerLocations[];
}

export interface MarkersRTMessage {
	type: MessageType.Markers;
	data: CSMarker[];
}

export interface PostsRTMessage {
	type: MessageType.Posts;
	data: CSPost[];
}

export interface RepositoriesRTMessage {
	type: MessageType.Repositories;
	data: CSRepository[];
}

export interface StreamsRTMessage {
	type: MessageType.Streams;
	data: (CSChannelStream | CSDirectStream)[];
}

export interface TeamsRTMessage {
	type: MessageType.Teams;
	data: CSTeam[];
}

export interface UnreadsRTMessage {
	type: MessageType.Unreads;
	data: CSUnreads;
}

export interface UsersRTMessage {
	type: MessageType.Users;
	data: CSUser[];
}

export interface RawRTMessage {
	type: MessageType;
	data?: any;
}

export type RTMessage =
	| ConnectionRTMessage
	| MarkerLocationsRTMessage
	| MarkersRTMessage
	| PostsRTMessage
	| RepositoriesRTMessage
	| StreamsRTMessage
	| TeamsRTMessage
	| UnreadsRTMessage
	| UsersRTMessage;

export interface ApiProvider {
	onDidReceiveMessage: Event<RTMessage>;

	readonly teamId: string;
	readonly userId: string;

	fetch<R extends object>(url: string, init?: RequestInit, token?: string): Promise<R>;
	useMiddleware(middleware: CodeStreamApiMiddleware): Disposable;

	login(options: LoginOptions): Promise<LoginResponse & { teamId: string }>;
	subscribe(types?: MessageType[]): Promise<void>;

	grantPubNubChannelAccess(token: string, channel: string): Promise<{}>;

	getMe(): Promise<GetMeResponse>;
	getUnreads(request: GetUnreadsRequest): Promise<GetUnreadsResponse>;
	updatePreferences(request: UpdatePreferencesRequest): Promise<GetMeResponse>;
	updatePresence(request: UpdatePresenceRequest): Promise<UpdatePresenceResponse>;

	// createFileStream(request: CreateFileStreamRequest): Promise<CreateFileStreamResponse>;
	fetchFileStreams(request: FetchFileStreamsRequest): Promise<FetchFileStreamsResponse>;

	createMarkerLocation(request: CreateMarkerLocationRequest): Promise<CreateMarkerLocationResponse>;
	fetchMarkerLocations(request: FetchMarkerLocationsRequest): Promise<FetchMarkerLocationsResponse>;

	fetchMarkers(request: FetchMarkersRequest): Promise<FetchMarkersResponse>;
	getMarker(request: GetMarkerRequest): Promise<GetMarkerResponse>;
	updateMarker(request: UpdateMarkerRequest): Promise<UpdateMarkerResponse>;

	createPost(request: CreatePostRequest): Promise<CreatePostResponse>;
	deletePost(request: DeletePostRequest): Promise<DeletePostResponse>;
	editPost(request: EditPostRequest): Promise<EditPostResponse>;
	fetchPostReplies(request: FetchPostRepliesRequest): Promise<FetchPostRepliesResponse>;
	fetchPosts(request: FetchPostsRequest): Promise<FetchPostsResponse>;
	getPost(request: GetPostRequest): Promise<GetPostResponse>;
	markPostUnread(request: MarkPostUnreadRequest): Promise<MarkPostUnreadResponse>;
	reactToPost(request: ReactToPostRequest): Promise<ReactToPostResponse>;

	createRepo(request: CreateRepoRequest): Promise<CreateRepoResponse>;
	fetchRepos(request: FetchReposRequest): Promise<FetchReposResponse>;
	getRepo(request: GetRepoRequest): Promise<GetRepoResponse>;

	createChannelStream(request: CreateChannelStreamRequest): Promise<CreateChannelStreamResponse>;
	createDirectStream(request: CreateDirectStreamRequest): Promise<CreateDirectStreamResponse>;
	fetchStreams(request: FetchStreamsRequest): Promise<FetchStreamsResponse>;
	fetchUnreadStreams(request: FetchUnreadStreamsRequest): Promise<FetchUnreadStreamsResponse>;
	getStream(request: GetStreamRequest): Promise<GetStreamResponse>;
	joinStream(request: JoinStreamRequest): Promise<JoinStreamResponse>;
	leaveStream(request: LeaveStreamRequest): Promise<LeaveStreamResponse>;
	markStreamRead(request: MarkStreamReadRequest): Promise<MarkStreamReadResponse>;
	updateStream(request: UpdateStreamRequest): Promise<UpdateStreamResponse>;
	updateStreamMembership(
		request: UpdateStreamMembershipRequest
	): Promise<UpdateStreamMembershipResponse>;
	setStreamPurpose(request: SetStreamPurposeRequest): Promise<SetStreamPurposeResponse>;

	fetchTeams(request: FetchTeamsRequest): Promise<FetchTeamsResponse>;
	getTeam(request: GetTeamRequest): Promise<GetTeamResponse>;

	fetchUsers(request: FetchUsersRequest): Promise<FetchUsersResponse>;
	getUser(request: GetUserRequest): Promise<GetUserResponse>;
	inviteUser(request: InviteUserRequest): Promise<InviteUserResponse>;
}

export interface CodeStreamApiMiddlewareContext {
	url: string;
	method: string;
	request: RequestInit | undefined;
	response?: Response;
}

export interface CodeStreamApiMiddleware {
	readonly name: string;
	onRequest?(context: Readonly<CodeStreamApiMiddlewareContext>): Promise<void>;
	onProvideResponse?<R>(context: Readonly<CodeStreamApiMiddlewareContext>): Promise<R>;
	onResponse?<R>(
		context: Readonly<CodeStreamApiMiddlewareContext>,
		responseJson: Promise<R> | undefined
	): Promise<void>;
}
