"use strict";
import { RequestInit } from "node-fetch";
import {
	InitializeResult,
	Range,
	RequestType,
	TextDocumentIdentifier
} from "vscode-languageserver-protocol";
import { Unreads } from "./agent.protocol.notifications";
import { ThirdPartyProviderInstance } from "./agent.protocol.providers";
import {
	CSLoginResponse,
	CSMarker,
	CSMePreferences,
	CSRepository,
	CSStream,
	CSTeam,
	CSUser,
	LoginResult
} from "./api.protocol";

export * from "./agent.protocol.notifications";

export * from "./agent.protocol.documentMarkers";
export * from "./agent.protocol.codemarks";
export * from "./agent.protocol.markers";
export * from "./agent.protocol.posts";
export * from "./agent.protocol.repos";
export * from "./agent.protocol.streams";
export * from "./agent.protocol.teams";
export * from "./agent.protocol.users";

export * from "./agent.protocol.scm";

export * from "./agent.protocol.providers";
export * from "./agent.protocol.asana";
export * from "./agent.protocol.bitbucket";
export * from "./agent.protocol.github";
export * from "./agent.protocol.gitlab";
export * from "./agent.protocol.jira";
export * from "./agent.protocol.trello";

export interface Capabilities {
	channelMute?: boolean;
	codemarkApply?: boolean;
	codemarkCompare?: boolean;
	editorTrackVisibleRange?: boolean;
	services?: {
		vsls?: boolean;
	};
}

export interface AccessToken {
	email: string;
	url: string;
	value: string;
}

export enum CodeStreamEnvironment {
	Local = "local",
	Production = "prod",
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
	proxySupport?: "override" | "on" | "off";
	serverUrl: string;
	traceLevel: TraceLevel;
	recordRequests?: boolean;
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
	capabilities: Capabilities;
	email: string;
	environment: CodeStreamEnvironment | string;
	serverUrl: string;
	teamId: string;
	userId: string;
}

export interface AgentResult {
	loginResponse: CSLoginResponse;
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
export const ApiRequestType = new RequestType<ApiRequest, any, void, void>("codestream/api");

export interface BootstrapRequest {}
export interface BootstrapResponse {
	preferences: CSMePreferences;
	repos: CSRepository[];
	streams: CSStream[];
	teams: CSTeam[];
	users: CSUser[];
	unreads: Unreads;
	providers: ThirdPartyProviderInstance[];
}
export const BootstrapRequestType = new RequestType<
	BootstrapRequest,
	BootstrapResponse,
	void,
	void
>("codestream/bootstrap");

export interface DocumentFromMarkerRequest {
	file?: string;
	repoId?: string;
	markerId: string;
}

export interface DocumentFromMarkerResponse {
	textDocument: TextDocumentIdentifier;
	marker: CSMarker;
	range: Range;
	revision?: string;
}

export const DocumentFromMarkerRequestType = new RequestType<
	DocumentFromMarkerRequest,
	DocumentFromMarkerResponse | undefined,
	void,
	void
>("codestream/textDocument/fromMarker");

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
>("codestream/textDocument/scm/revision");

export enum ReportingMessageType {
	Error = "error",
	Warning = "warning",
	Info = "info",
	Debug = "debug",
	Fatal = "fatal"
}

export interface ReportMessageRequest {
	type: ReportingMessageType;
	message: string;
	source: "webview" | "extension" | "agent";
	extra?: object;
}

export const ReportMessageRequestType = new RequestType<ReportMessageRequest, void, void, void>(
	"codestream/reporting/message"
);

/**
 * @param eventName The name of the telemetry event you want to track, eg: "Page Viewed"
 * @param properties Optional properties to pass along with eventName
 */
export interface TelemetryRequest {
	eventName: string;
	properties?: { [key: string]: string | number | boolean };
}

export const TelemetryRequestType = new RequestType<TelemetryRequest, void, void, void>(
	"codestream/telemetry"
);

export interface OpenUrlRequest {
	url: string;
}

export const OpenUrlRequestType = new RequestType<OpenUrlRequest, void, void, void>(
	"codestream/url/open"
);
