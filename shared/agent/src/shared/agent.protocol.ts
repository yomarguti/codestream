import { RequestInit } from "node-fetch";
import {
	InitializeResult,
	NotificationType,
	Range,
	RequestType,
	TextDocumentIdentifier
} from "vscode-languageserver-protocol";
import { CSMarker, CSPost, LoginResponse, LoginResult } from "./api.protocol";

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
