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
					authors: { id: string; name: string }[];
					remotes: { name: string; url: string }[];
			  }
			| undefined;
	}

	export const type = new RequestType<Params, Response, void, void>(
		"codeStream/textDocument/preparePost"
	);
}

export namespace DidReceivePubNubMessagesNotification {
	export interface Params {
		[key: string]: any;
	}

	export const type = new NotificationType<Params[], void>("codeStream/didReceivePubNubMessages");
}
