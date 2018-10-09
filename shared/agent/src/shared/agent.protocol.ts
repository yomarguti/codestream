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
	CSMarker,
	CSMarkerLocations,
	CSPost,
	CSRepository,
	CSStream,
	CSTeam,
	CSUser,
	LoginResponse,
	LoginResult
} from "./api.protocol";

export * from "./agent.protocol.markers";
export * from "./agent.protocol.posts";
export * from "./agent.protocol.repos";
export * from "./agent.protocol.streams";
export * from "./agent.protocol.teams";
export * from "./agent.protocol.users";

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
	isDebugging: boolean;

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

export interface ApiRequest {
	url: string;
	init?: RequestInit;
	token?: string;
}
export const ApiRequestType = new RequestType<ApiRequest, any, void, void>("codeStream/api");

export enum LogoutReason {
	Unknown = "unknown"
}

export interface LogoutRequest {
	reason?: LogoutReason;
}

export const LogoutRequestType = new RequestType<LogoutRequest, undefined, void, void>(
	"codeStream/logout"
);

export enum MessageType {
	Markers = "markers",
	MarkerLocations = "markerLocations",
	Posts = "posts",
	Repositories = "repos",
	Streams = "streams",
	Teams = "teams",
	Users = "users"
}

export interface MarkersChangedNotification {
	type: MessageType.Markers;
	markers: CSMarker[];
}

export interface MarkerLocationsChangedNotification {
	type: MessageType.MarkerLocations;
	markerLocations: CSMarkerLocations[];
}

export interface PostsChangedNotification {
	type: MessageType.Posts;
	posts: CSPost[];
}

export interface RepositoriesChangedNotification {
	type: MessageType.Repositories;
	repos: CSRepository[];
}

export interface StreamsChangedNotification {
	type: MessageType.Streams;
	streams: CSStream[];
}

export interface TeamsChangedNotification {
	type: MessageType.Teams;
	teams: CSTeam[];
}

export interface UsersChangedNotification {
	type: MessageType.Users;
	users: CSUser[];
}

export type DidChangeDataNotification =
	| MarkersChangedNotification
	| MarkerLocationsChangedNotification
	| PostsChangedNotification
	| RepositoriesChangedNotification
	| StreamsChangedNotification
	| UsersChangedNotification
	| TeamsChangedNotification;

export const DidChangeDataNotificationType = new NotificationType<DidChangeDataNotification, void>(
	"codeStream/didChangeData"
);

export enum VersionCompatibility {
	Compatible = "ok",
	CompatibleUpgradeAvailable = "outdated",
	CompatibleUpgradeRecommended = "deprecated",
	UnsupportedUpgradeRequired = "incompatible",
	Unknown = "unknownVersion"
}

export interface DidChangeVersionCompatibilityNotificationResponse {
	compatibility: VersionCompatibility;
	downloadUrl: string;
	version: string | undefined;
}

export const DidChangeVersionCompatibilityNotificationType = new NotificationType<
	DidChangeVersionCompatibilityNotificationResponse,
	void
>("codeStream/didChangeVersionCompatibility");

export interface DocumentFromCodeBlockRequest {
	file: string;
	repoId: string;
	markerId: string;
}

export interface DocumentFromCodeBlockResponse {
	textDocument: TextDocumentIdentifier;
	range: Range;
	revision?: string;
}

export const DocumentFromCodeBlockRequestType = new RequestType<
	DocumentFromCodeBlockRequest,
	DocumentFromCodeBlockResponse | undefined,
	void,
	void
>("codeStream/textDocument/fromCodeBlock");

export interface DocumentLatestRevisionRequest {
	textDocument: TextDocumentIdentifier;
}

export interface DocumentLatestRevisionResponse {
	revision?: string;
}

export const DocumentLatestRevisionRequestType = new RequestType<
	DocumentLatestRevisionRequest,
	DocumentLatestRevisionResponse,
	void,
	void
>("codeStream/textDocument/scm/revision");
