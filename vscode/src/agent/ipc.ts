// TODO: Fix this, but for now keep in sync with ipc/agent.ts in codestream-lsp-agent

"use strict";
import { RequestInit } from "node-fetch";
import {
	NotificationType,
	Range,
	RequestType,
	RequestType0,
	TextDocumentIdentifier
} from "vscode-languageclient";
import { CSPost } from "../api/types";
import { GitApiRepository } from "../git/git";

export namespace ApiRequest {
	export interface Params {
		url: string;
		token: string;
		init: RequestInit;
	}

	export const type = new RequestType<Params, any, void, void>("codeStream/api");
}

export namespace GitRepositoriesRequest {
	export const type = new RequestType0<GitApiRepository[], void, void>("codeStream/git/repos");
}

// export namespace DocumentMarkersRequest {
// 	export interface Params {
// 		textDocument: TextDocumentIdentifier;
// 	}

// 	export const type = new RequestType<
// 		Params,
// 		Promise<MarkerHandler.HandleMarkersResponse | undefined>,
// 		void,
// 		void
// 	>("codeStream/textDocument/markers");
// }

export namespace DocumentPreparePostRequest {
	export interface Params {
		textDocument: TextDocumentIdentifier;
		range: Range;
		dirty: boolean;
	}

	export interface Response {
		code: string;
		source:
			| {
					file: string;
					repoPath: string;
					revision: string;
					authors: { id: string; username: string }[];
					remotes: { name: string; url: string }[];
			  }
			| undefined;
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
		location: [number, number, number, number] | undefined;
		source:
			| {
					file: string;
					repoPath: string;
					revision: string;
					authors: { id: string; username: string }[];
					remotes: { name: string; url: string }[];
			  }
			| undefined;
		parentPostId: string | undefined;
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
