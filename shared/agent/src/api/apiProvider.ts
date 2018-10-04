import { RequestInit, Response } from "node-fetch";
import { Disposable } from "vscode-languageserver";
import {
	AccessToken,
	CreateChannelStreamRequest,
	CreateChannelStreamResponse,
	CreateDirectStreamRequest,
	CreateDirectStreamResponse,
	CreatePostRequest,
	CreatePostResponse,
	CreateRepoRequest,
	CreateRepoResponse,
	DeletePostRequest,
	DeletePostResponse,
	EditPostRequest,
	EditPostResponse,
	FetchLatestPostRequest,
	FetchLatestPostResponse,
	FetchPostRepliesRequest,
	FetchPostRepliesResponse,
	FetchPostsByRangeRequest,
	FetchPostsByRangeResponse,
	FetchPostsRequest,
	FetchPostsResponse,
	FetchReposRequest,
	FetchReposResponse,
	GetMeResponse,
	GetPostRequest,
	GetPostResponse,
	InviteUserRequest,
	InviteUserResponse,
	MarkPostUnreadRequest,
	MarkPostUnreadResponse,
	ReactToPostRequest,
	ReactToPostResponse,
	UpdatePreferencesRequest
} from "../agent";
import { UpdatePresenceRequest, UpdatePresenceResponse } from "../shared/agent.protocol";
import {
	CSChannelStream,
	CSDirectStream,
	CSFileStream,
	CSMarker,
	CSMarkerLocations,
	CSMePreferences,
	CSPost,
	CSPresenceStatus,
	CSRepository,
	CSStream,
	CSTeam,
	CSUser,
	LoginResponse
} from "../shared/api.protocol";

export interface VersionInfo {
	readonly ideVersion: string;
	readonly extensionVersion: string;
	readonly extensionBuild: string;
}

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

export interface ApiProvider {
	baseUrl: string;
	fetch<R extends object>(url: string, init?: RequestInit, token?: string): Promise<R>;
	useMiddleware(middleware: CodeStreamApiMiddleware): Disposable;

	login(options: LoginOptions): Promise<LoginResponse & { teamId: string }>;

	getMe(): Promise<GetMeResponse>;
	inviteUser(request: InviteUserRequest): Promise<InviteUserResponse>;
	updatePreferences(request: UpdatePreferencesRequest): Promise<GetMeResponse>;
	updatePresence(request: UpdatePresenceRequest): Promise<UpdatePresenceResponse>;

	createPost(request: CreatePostRequest): Promise<CreatePostResponse>;
	deletePost(request: DeletePostRequest): Promise<DeletePostResponse>;
	editPost(request: EditPostRequest): Promise<EditPostResponse>;
	fetchLatestPost(request: FetchLatestPostRequest): Promise<FetchLatestPostResponse>;
	fetchPostReplies(request: FetchPostRepliesRequest): Promise<FetchPostRepliesResponse>;
	fetchPosts(request: FetchPostsRequest): Promise<FetchPostsResponse>;
	fetchPostsByRange(request: FetchPostsByRangeRequest): Promise<FetchPostsByRangeResponse>;
	getPost(request: GetPostRequest): Promise<GetPostResponse>;
	markPostUnread(request: MarkPostUnreadRequest): Promise<MarkPostUnreadResponse>;
	reactToPost(request: ReactToPostRequest): Promise<ReactToPostResponse>;

	// getMarker(markerId: string, teamId?: string): Promise<CSMarker>;
	// getMarkers(commitHash: string, streamId: string, teamId?: string): Promise<CSMarker[]>;
	// getMarkerLocations(
	// 	commitHash: string,
	// 	streamId: string,
	// 	teamId?: string
	// ): Promise<CSMarkerLocations>;

	createRepo(request: CreateRepoRequest): Promise<CreateRepoResponse>;
	fetchRepos(): Promise<FetchReposResponse>;
	// getRepo(repoId: string, teamId?: string): Promise<CSRepository | undefined>;

	createChannelStream(request: CreateChannelStreamRequest): Promise<CreateChannelStreamResponse>;
	createDirectStream(request: CreateDirectStreamRequest): Promise<CreateDirectStreamResponse>;
	// createFileStream(request: CreateDirectStreamRequest): Promise<CreateFileStreamResponse>;

	// getStream(streamId: string, teamId?: string): Promise<CSStream | undefined>;
	// getUnreadStreams(teamId?: string): Promise<CSStream[]>;
	// getChannelStreams(teamId?: string): Promise<CSChannelStream[]>;
	// getChannelOrDirectStreams(teamId?: string): Promise<(CSChannelStream | CSDirectStream)[]>;
	// getDirectStreams(teamId?: string): Promise<CSDirectStream[]>;
	// getFileStreams(repoId: string, teamId?: string): Promise<CSFileStream[]>;
	// joinStream(streamId: string, teamId?: string): Promise<CSStream>;
	// leaveStream(streamId: string, teamId?: string): Promise<CSStream>;
	// markStreamRead(streamId: string): Promise<{}>;
	// updateStream(streamId: string, update: object): Promise<CSStream>;

	// getTeam(teamId: string): Promise<CSTeam | undefined>;
	// getTeams(ids: string[]): Promise<CSTeam[]>;

	// getUser(userId: string, teamId?: string): Promise<CSUser | undefined>;
	// getUsers(teamId?: string): Promise<CSUser[]>;
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
