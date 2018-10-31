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
	CSMePreferences,
	CSPost,
	CSRepository,
	CSStream,
	CSTeam,
	CSUser,
	LoginResponse,
	LoginResult
} from "./api.protocol";
import { CSLastReads } from "./api.protocol.models";

export * from "./agent.protocol.markers";
export * from "./agent.protocol.posts";
export * from "./agent.protocol.repos";
export * from "./agent.protocol.streams";
export * from "./agent.protocol.teams";
export * from "./agent.protocol.users";

export interface ApiCapabilities {
	mute: boolean;
}

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

export enum TraceLevel {
	Silent = "silent",
	Errors = "errors",
	Verbose = "verbose",
	Debug = "debug"
}

export interface BaseAgentOptions {
	extension: {
		build: string;
		buildEnv: string;
		version: string;
		versionFormatted: string;
	};
	gitPath: string;
	ide: {
		name: string;
		version: string;
	};
	isDebugging: boolean;
	proxy?: {
		url: string;
		strictSSL: boolean;
	};
	serverUrl: string;
	traceLevel: TraceLevel;
}

export interface AgentOptions extends BaseAgentOptions {
	email: string;
	passwordOrToken: string | AccessToken;
	signupToken: string;
	team: string;
	teamId: string;
}

export interface AgentState {
	apiToken: string;
	capabilities: ApiCapabilities;
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

export enum ChangeDataType {
	MarkerLocations = "markerLocations",
	Markers = "markers",
	Posts = "posts",
	Preferences = "preferences",
	Repositories = "repos",
	Streams = "streams",
	Teams = "teams",
	Unreads = "unreads",
	Users = "users"
}

export interface MarkerLocationsChangedNotification {
	type: ChangeDataType.MarkerLocations;
	data: CSMarkerLocations[];
}

export interface MarkersChangedNotification {
	type: ChangeDataType.Markers;
	data: CSMarker[];
}

export interface PostsChangedNotification {
	type: ChangeDataType.Posts;
	data: CSPost[];
}

export interface PreferencesChangedNotification {
	type: ChangeDataType.Preferences;
	data: CSMePreferences;
}

export interface RepositoriesChangedNotification {
	type: ChangeDataType.Repositories;
	data: CSRepository[];
}

export interface StreamsChangedNotification {
	type: ChangeDataType.Streams;
	data: CSStream[];
}

export interface TeamsChangedNotification {
	type: ChangeDataType.Teams;
	data: CSTeam[];
}

export interface CSUnreads {
	lastReads: CSLastReads;
	mentions: { [streamId: string]: number };
	unreads: { [streamId: string]: number };
	totalMentions: number;
	totalUnreads: number;
}

export interface UnreadsChangedNotification {
	type: ChangeDataType.Unreads;
	data: CSUnreads;
}

export interface UsersChangedNotification {
	type: ChangeDataType.Users;
	data: CSUser[];
}

export type DidChangeDataNotification =
	| MarkerLocationsChangedNotification
	| MarkersChangedNotification
	| PostsChangedNotification
	| PreferencesChangedNotification
	| RepositoriesChangedNotification
	| StreamsChangedNotification
	| TeamsChangedNotification
	| UnreadsChangedNotification
	| UsersChangedNotification;

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
