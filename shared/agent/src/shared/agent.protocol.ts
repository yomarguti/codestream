"use strict";
import { RequestInit } from "node-fetch";
import {
	InitializeResult,
	NotificationType,
	Range,
	RequestType,
	TextDocumentIdentifier
} from "vscode-languageserver-protocol";
import {
	CreateRepoRequest,
	CreateRepoResponse,
	CSMarker,
	CSMarkerLocations,
	CSRepository,
	CSTeam,
	CSUser,
	FindRepoResponse,
	GetMarkerResponse,
	GetMarkersResponse,
	GetMeResponse,
	GetRepoResponse,
	GetReposResponse,
	GetTeamResponse,
	GetUserResponse,
	InviteRequest,
	InviteResponse,
	LoginResponse,
	LoginResult,
	UpdatePresenceRequest,
	UpdatePresenceResponse,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse
} from "./api.protocol";

export * from "./agent.protocol.posts";
export * from "./agent.protocol.streams";

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

export enum LogoutReason {
	Unknown = "unknown"
}

export interface LogoutRequestParams {
	reason?: LogoutReason;
}

export const LogoutRequest = new RequestType<LogoutRequestParams, undefined, void, void>(
	"codeStream/logout"
);

export const CreateRepoRequestType = new RequestType<
	CreateRepoRequest,
	CreateRepoResponse,
	void,
	void
>("codeStream/createRepo");

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

export interface FetchMarkerLocationsRequest {
	streamId: string;
	commitHash: string;
}

export interface FetchMarkerLocationsResponse {
	markerLocations: CSMarkerLocations;
}

export const FetchMarkerLocationsRequestType = new RequestType<
	FetchMarkerLocationsRequest,
	FetchMarkerLocationsResponse,
	void,
	void
>("codeStream/fetchMarkerLocations");

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

export interface GetRepoRequest {
	repoId: string;
}

export const GetRepoRequestType = new RequestType<GetRepoRequest, GetRepoResponse, void, void>(
	"codeStream/getRepo"
);

export interface FetchReposRequest {}

export interface FetchReposResponse {
	repos: CSRepository[];
}

export const FetchReposRequestType = new RequestType<
	FetchReposRequest,
	FetchReposResponse,
	void,
	void
>("codeStream/fetchRepos");

export interface GetTeamRequest {
	teamId: string;
}

export const GetTeamRequestType = new RequestType<GetTeamRequest, GetTeamResponse, void, void>(
	"codeStream/getTeam"
);

export interface FetchTeamsRequest {
	teamIds: string[];
}

export interface FetchTeamsResponse {
	teams: CSTeam[];
}

export const FetchTeamsRequestType = new RequestType<
	FetchTeamsRequest,
	FetchTeamsResponse,
	void,
	void
>("codeStream/fetchTeams");

export interface GetUserRequest {
	userId: string;
}

export const GetUserRequestType = new RequestType<GetUserRequest, GetUserResponse, void, void>(
	"codeStream/getUser"
);

export interface FetchUsersRequest {}

export interface FetchUsersResponse {
	users: CSUser[];
}

export const FetchUsersRequestType = new RequestType<
	FetchUsersRequest,
	FetchUsersResponse,
	void,
	void
>("codeStream/fetchUsers");

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
