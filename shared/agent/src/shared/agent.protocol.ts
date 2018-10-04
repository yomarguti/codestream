"use strict";
import { RequestInit } from "node-fetch";
import {
	InitializeResult,
	NotificationType,
	Range,
	RequestType,
	TextDocumentIdentifier
} from "vscode-languageserver-protocol";
import { LoginResponse, LoginResult } from "./api.protocol";

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

export interface DidReceivePubNubMessagesNotificationResponse {
	[key: string]: any;
}

export const DidReceivePubNubMessagesNotificationType = new NotificationType<
	DidReceivePubNubMessagesNotificationResponse[],
	void
>("codeStream/didReceivePubNubMessages");

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
