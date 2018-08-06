import { RequestInit } from "node-fetch";
import {
	InitializeResult,
	NotificationType,
	Range,
	RequestType,
	RequestType0,
	TextDocumentIdentifier
} from "vscode-languageserver-protocol";
import { CSPost, LoginResponse, LoginResult } from "./api.protocol";

export interface AccessToken {
	value: string;
}

export interface AgentOptions {
	extensionVersion: string;
	gitPath: string;
	ideVersion: string;

	serverUrl: string;
	email: string;
	passwordOrToken: string | AccessToken;
	team: string;
	teamId: string;
	signupToken: string;
}

export interface AgentResult {
	loginResponse: LoginResponse;
	state: {
		email: string;
		userId: string;
		teamId: string;
		token: string;
		serverUrl: string;
	};
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

export interface GitRepositoriesResponse {
	uri: string;
}

export const GitRepositoriesRequest = new RequestType0<GitRepositoriesResponse[], void, void>(
	"codeStream/git/repos"
);

export interface DocumentMarkersRequestParams {
	textDocument: TextDocumentIdentifier;
}

export interface MarkerWithRange {
	id: string;
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

export interface DidReceivePubNubMessagesNotificationParams {
	[key: string]: any;
}

export const DidReceivePubNubMessagesNotification = new NotificationType<
	DidReceivePubNubMessagesNotificationParams[],
	void
>("codeStream/didReceivePubNubMessages");
