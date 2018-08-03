/// <reference types="codestream" />

declare module "codestream-agent" {
	import { RequestInit } from "node-fetch";
	import {
		InitializeResult,
		NotificationType,
		Range,
		RequestType,
		RequestType0,
		TextDocumentIdentifier
	} from "vscode-languageserver-protocol";
	import { LoginResponse, LoginResult, CSPost } from "codestream";

	export interface AccessToken {
		value: string;
	}

	export interface AgentOptions {
		extensionVersion: string;
		gitPath: string;
		ideVersion: string;

		serverUrl: string;
		email: string;
		token: string;
		// passwordOrToken: string | AccessToken;
		team: string;
		teamId: string;
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

	export namespace ApiRequest {
		export interface Params {
			url: string;
			init?: RequestInit;
			token?: string;
		}

		export const type = new RequestType<Params, any, void, void>("codeStream/api");
	}

	export namespace GitRepositoriesRequest {
		export interface Response {
			uri: string;
		}

		export const type = new RequestType0<Response[], void, void>("codeStream/git/repos");
	}

	export interface MarkerWithRange {
		id: string;
		range: Range;
	}

	export namespace DocumentMarkersRequest {
		export interface Params {
			textDocument: TextDocumentIdentifier;
		}

		export interface Response {
			markers: MarkerWithRange[];
		}

		export const type = new RequestType<Params, Response | undefined, void, void>(
			"codeStream/textDocument/markers"
		);
	}

	export interface CodeBlockSource {
		file: string;
		repoPath: string;
		revision: string;
		authors: { id: string; username: string }[];
		remotes: { name: string; url: string }[];
	}

	export namespace DocumentPreparePostRequest {
		export interface Params {
			textDocument: TextDocumentIdentifier;
			range: Range;
			dirty: boolean;
		}

		export interface Response {
			code: string;
			source?: CodeBlockSource;
		}

		export const type = new RequestType<Params, Response, void, void>(
			"codeStream/textDocument/preparePost"
		);
	}

	export namespace DocumentPostRequest {
		export interface Params {
			textDocument: TextDocumentIdentifier;
			text: string;
			code: string;
			location?: [number, number, number, number];
			source?: CodeBlockSource;
			parentPostId?: string;
			streamId: string;
			teamId?: string;
		}

		export const type = new RequestType<Params, CSPost, void, void>("codeStream/textDocument/post");
	}

	export namespace DidReceivePubNubMessagesNotification {
		export interface Params {
			[key: string]: any;
		}

		export const type = new NotificationType<Params[], void>("codeStream/didReceivePubNubMessages");
	}
}
