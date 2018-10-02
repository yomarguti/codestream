import { RequestInit } from "node-fetch";
import {
	InitializeResult,
	NotificationType,
	Range,
	RequestType,
	TextDocumentIdentifier
} from "vscode-languageserver-protocol";
import {
	CreatePostRequest,
	CreatePostResponse,
	CreateRepoRequest,
	CreateRepoResponse,
	CreateStreamRequest,
	CreateStreamResponse,
	CSMarker,
	CSPost,
	CSStream,
	CSUser,
	DeletePostResponse,
	EditPostRequest,
	EditPostResponse,
	FindRepoResponse,
	GetMarkerLocationsResponse,
	GetMarkerResponse,
	GetMarkersResponse,
	GetMeResponse,
	GetPostResponse,
	GetRepoResponse,
	GetReposResponse,
	GetTeamResponse,
	GetTeamsResponse,
	GetUserResponse,
	GetUsersResponse,
	InviteRequest,
	InviteResponse,
	JoinStreamRequest,
	JoinStreamResponse,
	LoginResponse,
	LoginResult,
	MarkPostUnreadRequest,
	MarkPostUnreadResponse,
	ReactToPostRequest,
	ReactToPostResponse,
	UpdatePresenceRequest,
	UpdatePresenceResponse,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse
} from "./api.protocol";

export interface AccessToken {
	email: string;
	url: string;
	value: string;
}

export enum CodeStreamEnvironment {
	PD = "pd",
	Production = "prod",
	QA = "qa",
	Unknown = "unknown"
}

export interface AgentOptions {
	extensionBuild: string;
	extensionBuildEnv: string;
	extensionVersion: string;
	extensionVersionFormatted: string;
	gitPath: string;
	ideVersion: string;

	email: string;
	passwordOrToken: string | AccessToken;
	serverUrl: string;
	signupToken: string;
	team: string;
	teamId: string;
}

export interface AgentState {
	apiToken: string;
	email: string;
	environment: CodeStreamEnvironment;
	serverUrl: string;
	teamId: string;
	userId: string;
}

export interface AgentResult {
	loginResponse: LoginResponse;
	state: AgentState;
	error?: LoginResult;
}

export interface AgentInitializeResult extends InitializeResult {
	result: AgentResult;
}

export interface ApiRequestParams {
	url: string;
	init?: RequestInit;
	token?: string;
}
export const ApiRequest = new RequestType<ApiRequestParams, any, void, void>("codeStream/api");

export const DidReceivePubNubMessagesNotification = new NotificationType<
	DidReceivePubNubMessagesNotificationResponse[],
	void
>("codeStream/didReceivePubNubMessages");

export interface DidReceivePubNubMessagesNotificationResponse {
	[key: string]: any;
}

export const DidChangeDocumentMarkersNotification = new NotificationType<
	DidChangeDocumentMarkersNotificationResponse,
	void
>("codeStream/didChangeDocumentMarkers");

export interface DidChangeDocumentMarkersNotificationResponse {
	textDocument: TextDocumentIdentifier;
}

export enum VersionCompatibility {
	Compatible = "ok",
	CompatibleUpgradeAvailable = "outdated",
	CompatibleUpgradeRecommended = "deprecated",
	UnsupportedUpgradeRequired = "incompatible",
	Unknown = "unknownVersion"
}

export const DidChangeVersionCompatibilityNotification = new NotificationType<
	DidChangeVersionCompatibilityNotificationResponse,
	void
>("codeStream/didChangeVersionCompatibility");

export interface DidChangeVersionCompatibilityNotificationResponse {
	compatibility: VersionCompatibility;
	downloadUrl: string;
	version: string | undefined;
}

export interface DocumentFromCodeBlockRequestParams {
	file: string;
	repoId: string;
	markerId: string;
}

export interface DocumentFromCodeBlockResponse {
	textDocument: TextDocumentIdentifier;
	range: Range;
	revision?: string;
}

export const DocumentFromCodeBlockRequest = new RequestType<
	DocumentFromCodeBlockRequestParams,
	DocumentFromCodeBlockResponse | undefined,
	void,
	void
>("codeStream/textDocument/fromCodeBlock");

export interface DocumentLatestRevisionRequestParams {
	textDocument: TextDocumentIdentifier;
}

export interface DocumentLatestRevisionResponse {
	revision?: string;
}

export const DocumentLatestRevisionRequest = new RequestType<
	DocumentLatestRevisionRequestParams,
	DocumentLatestRevisionResponse,
	void,
	void
>("codeStream/textDocument/scm/revision");

export interface DocumentMarkersRequestParams {
	textDocument: TextDocumentIdentifier;
}

export interface MarkerWithRange extends CSMarker {
	range: Range;
}

export interface DocumentMarkersResponse {
	markers: MarkerWithRange[];
}

export const DocumentMarkersRequest = new RequestType<
	DocumentMarkersRequestParams,
	DocumentMarkersResponse | undefined,
	void,
	void
>("codeStream/textDocument/markers");

export interface CodeBlockSource {
	file: string;
	repoPath: string;
	revision: string;
	authors: { id: string; username: string }[];
	remotes: { name: string; url: string }[];
}

export interface DocumentPreparePostRequestParams {
	textDocument: TextDocumentIdentifier;
	range: Range;
	dirty: boolean;
}

export interface DocumentPreparePostResponse {
	code: string;
	source?: CodeBlockSource;
	gitError?: string;
}

export const DocumentPreparePostRequest = new RequestType<
	DocumentPreparePostRequestParams,
	DocumentPreparePostResponse,
	void,
	void
>("codeStream/textDocument/preparePost");

export interface DocumentPostRequestParams {
	textDocument: TextDocumentIdentifier;
	text: string;
	mentionedUserIds: string[];
	code: string;
	location?: [number, number, number, number];
	source?: CodeBlockSource;
	parentPostId?: string;
	streamId: string;
	teamId?: string;
}

export const DocumentPostRequest = new RequestType<DocumentPostRequestParams, CSPost, void, void>(
	"codeStream/textDocument/post"
);

export enum LogoutReason {
	Unknown = "unknown"
}

export interface LogoutRequestParams {
	reason?: LogoutReason;
}

export const LogoutRequest = new RequestType<LogoutRequestParams, undefined, void, void>(
	"codeStream/logout"
);

export interface GetPostsRequestParams {
	streamId: string;
	limit: number;
	beforeSeq?: number;
	afterSeq?: number;
}

export interface GetPostsResponse {
	posts: CSPost[];
	maxSeq: number;
}

export const GetPostsRequest = new RequestType<GetPostsRequestParams, GetPostsResponse, void, void>(
	"codeStream/posts"
);

export const CreatePostRequestType = new RequestType<
	CreatePostRequest,
	CreatePostResponse,
	void,
	void
>("codeStream/createPost");

export const CreateRepoRequestType = new RequestType<
	CreateRepoRequest,
	CreateRepoResponse,
	void,
	void
>("codeStream/createRepo");

export const CreateStreamRequestType = new RequestType<
	CreateStreamRequest,
	CreateStreamResponse,
	void,
	void
>("codeStream/createStream");

export interface DeletePostRequest {
	teamId: string;
	postId: string;
}

export const DeletePostRequestType = new RequestType<
	DeletePostRequest,
	DeletePostResponse,
	void,
	void
>("codeStream/deletePost");

export const ReactToPostRequestType = new RequestType<
	ReactToPostRequest,
	ReactToPostResponse,
	void,
	void
>("codeStream/reactToPost");

export const EditPostRequestType = new RequestType<EditPostRequest, EditPostResponse, void, void>(
	"codeStream/editPost"
);

export const MarkPostUnreadRequestType = new RequestType<
	MarkPostUnreadRequest,
	MarkPostUnreadResponse,
	void,
	void
>("codeStream/markPostUnread");

export interface FindRepoRequest {
	url: string;
	firstCommitHashes: string[];
}

export const FindRepoRequestType = new RequestType<FindRepoRequest, FindRepoResponse, void, void>(
	"codeStream/findRepo"
);

export interface GetMarkerRequest {
	teamId: string;
	markerId: string;
}

export const GetMarkerRequestType = new RequestType<
	GetMarkerRequest,
	GetMarkerResponse,
	void,
	void
>("codeStream/getMarker");

export interface GetMarkerLocationsRequest {
	teamId: string;
	streamId: string;
	commitHash: string;
}

export const GetMarkerLocationsRequestType = new RequestType<
	GetMarkerLocationsRequest,
	GetMarkerLocationsResponse,
	void,
	void
>("codeStream/getMarkerLocations");

export interface GetMarkersRequest {
	teamId: string;
	streamId: string;
}

export const GetMarkersRequestType = new RequestType<
	GetMarkersRequest,
	GetMarkersResponse,
	void,
	void
>("codeStream/getMarkers");

export interface GetPostRequest {
	teamId: string;
	postId: string;
}

export const GetPostRequestType = new RequestType<GetPostRequest, GetPostResponse, void, void>(
	"codeStream/getPost"
);

export interface GetLatestPostRequest {
	teamId: string;
	streamId: string;
}

export interface GetLatestPostResponse {
	post: CSPost;
}

export const GetLatestPostRequestType = new RequestType<
	GetLatestPostRequest,
	GetLatestPostResponse,
	void,
	void
>("codeStream/getLatestPost");

export interface GetPostsInRangeRequest {
	teamId: string;
	streamId: string;
	range: string;
}

export interface GetPostsInRangeResponse {
	posts: CSPost[];
	more?: boolean;
}

export const GetPostsInRangeRequestType = new RequestType<
	GetPostsInRangeRequest,
	GetPostsInRangeResponse,
	void,
	void
>("codeStream/getPostsInRange");

export interface GetRepoRequest {
	teamId: string;
	repoId: string;
}

export const GetRepoRequestType = new RequestType<GetRepoRequest, GetRepoResponse, void, void>(
	"codeStream/getRepo"
);

export interface GetReposRequest {
	teamId: string;
}

export const GetReposRequestType = new RequestType<GetReposRequest, GetReposResponse, void, void>(
	"codeStream/getRepos"
);

export interface GetStreamRequest {
	teamId: string;
	streamId: string;
}

export interface GetStreamResponse {
	stream: CSStream;
}

export const GetStreamRequestType = new RequestType<
	GetStreamRequest,
	GetStreamResponse,
	void,
	void
>("codeStream/getStream");

export interface GetUnreadStreamsRequest {
	teamId: string;
}

export interface GetUnreadStreamsResponse {
	streams: CSStream[];
}

export const GetUnreadStreamsRequestType = new RequestType<
	GetUnreadStreamsRequest,
	GetUnreadStreamsResponse,
	void,
	void
>("codeStream/getUnreadStreams");

export interface GetStreamsRequest {
	teamId: string;
	repoId?: string;
}

export interface GetStreamsResponse {
	streams: CSStream[];
}

export const GetStreamsRequestType = new RequestType<
	GetStreamsRequest,
	GetStreamsResponse,
	void,
	void
>("codeStream/getStreams");

export interface GetTeamRequest {
	teamId: string;
}

export const GetTeamRequestType = new RequestType<GetTeamRequest, GetTeamResponse, void, void>(
	"codeStream/getTeam"
);

export interface GetTeamsRequest {
	teamIds: string[];
}

export const GetTeamsRequestType = new RequestType<GetTeamsRequest, GetTeamsResponse, void, void>(
	"codeStream/getTeam"
);

export interface GetUserRequest {
	teamId: string;
	userId: string;
}

export const GetUserRequestType = new RequestType<GetUserRequest, GetUserResponse, void, void>(
	"codeStream/getUser"
);

export interface GetUsersRequest {
	teamId: string;
}

export const GetUsersRequestType = new RequestType<GetUsersRequest, GetUsersResponse, void, void>(
	"codeStream/getUsers"
);

export const JoinStreamRequestType = new RequestType<
	JoinStreamRequest,
	JoinStreamResponse,
	void,
	void
>("codeStream/joinStream");

export interface UpdateStreamRequest {
	streamId: string;
	data: object;
}

export interface UpdateStreamResponse {}

export const UpdateStreamRequestType = new RequestType<
	UpdateStreamRequest,
	UpdateStreamResponse,
	void,
	void
>("codeStream/updateStream");

export const UpdatePresenceRequestType = new RequestType<
	UpdatePresenceRequest,
	UpdatePresenceResponse,
	void,
	void
>("codeStream/updatePresence");

export const UpdateStreamMembershipRequestType = new RequestType<
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse,
	void,
	void
>("codeStream/updateStreamMembership");

export const InviteRequestType = new RequestType<InviteRequest, InviteResponse, void, void>(
	"codeStream/updateStreamMembership"
);

export interface MarkStreamReadRequest {
	streamId: string;
}

export interface MarkStreamReadResponse {}

export const MarkStreamReadRequestType = new RequestType<
	MarkStreamReadRequest,
	MarkStreamReadResponse,
	void,
	void
>("codeStream/markStreamRead");

export interface SavePreferencesRequest {
	preferences: object;
}
export interface SavePreferencesResponse {}

export const SavePreferencesRequestType = new RequestType<
	SavePreferencesRequest,
	SavePreferencesResponse,
	void,
	void
>("codeStream/savePreferences");

export interface GetMeRequest {}

export const GetMeRequestType = new RequestType<GetMeRequest, GetMeResponse, void, void>(
	"codeStream/getMe"
);
