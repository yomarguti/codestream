"use strict";
import { RequestInit } from "node-fetch";
import {
	InitializeResult,
	NotificationType,
	Range,
	RequestType,
	TextDocumentIdentifier
} from "vscode-languageserver-protocol";
import { CSFullCodemark } from "./agent.protocol.markers";
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

export interface DidLogoutNotification {
	reason: LogoutReason;
}

export const DidLogoutNotificationType = new NotificationType<DidLogoutNotification, void>(
	"codeStream/didLogout"
);

export enum ChangeDataType {
	Codemarks = "codemarks",
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

export interface CodemarksChangedNotification {
	type: ChangeDataType.Codemarks;
	data: CSFullCodemark[];
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
	| CodemarksChangedNotification
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

export enum ConnectionStatus {
	Disconnected = "disconnected",
	Reconnected = "reconnected",
	Reconnecting = "reconnecting"
}

export interface DidChangeConnectionStatusNotification {
	reset?: boolean;
	status: ConnectionStatus;
}

export const DidChangeConnectionStatusNotificationType = new NotificationType<
	DidChangeConnectionStatusNotification,
	void
>("codeStream/didChangeConnectionStatus");

export enum VersionCompatibility {
	Compatible = "ok",
	CompatibleUpgradeAvailable = "outdated",
	CompatibleUpgradeRecommended = "deprecated",
	UnsupportedUpgradeRequired = "incompatible",
	Unknown = "unknownVersion"
}

export interface DidChangeVersionCompatibilityNotification {
	compatibility: VersionCompatibility;
	downloadUrl: string;
	version: string | undefined;
}

export const DidChangeVersionCompatibilityNotificationType = new NotificationType<
	DidChangeVersionCompatibilityNotification,
	void
>("codeStream/didChangeVersionCompatibility");

export interface DocumentFromMarkerRequest {
	file: string;
	repoId: string;
	markerId: string;
}

export interface DocumentFromMarkerResponse {
	textDocument: TextDocumentIdentifier;
	range: Range;
	revision?: string;
}

export const DocumentFromMarkerRequestType = new RequestType<
	DocumentFromMarkerRequest,
	DocumentFromMarkerResponse | undefined,
	void,
	void
>("codeStream/textDocument/fromMarker");

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

export interface ReportErrorRequest {
	message: string;
	source: "webview" | "extension";
	extra?: object;
}

export const ReportErrorRequestType = new RequestType<ReportErrorRequest, void, void, void>(
	"codeStream/reporting/error"
);

/**
 * @param eventName The name of the Mixpanel you want to track, eg: "Page Viewed"
 * @param properties Optional properties to pass along with eventName
 */
export interface TelemetryRequest {
	eventName: string;
	properties?: { [key: string]: string | number | boolean };
}

export const TelemetryRequestType = new RequestType<TelemetryRequest, void, void, void>(
	"codeStream/telemetry"
);
