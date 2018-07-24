"use strict";
import { RequestInit } from "node-fetch";
import {
	NotificationType,
	Range,
	RequestType,
	RequestType0,
	TextDocumentIdentifier
} from "vscode-languageserver";
import { CSPost } from "../api/api";
import { GitApiRepository } from "../git/git";

export namespace ApiRequest {
	export interface Params {
		url: string;
		token: string;
		init: RequestInit;
	}

	export const type = new RequestType<Params, Promise<{}>, void, void>("codeStream/api");
}

export namespace GitRepositoriesRequest {
	export const type = new RequestType0<Promise<GitApiRepository[]>, void, void>(
		"codeStream/git/repos"
	);
}

export namespace PostCodeRequest {
	export interface Params {
		document: TextDocumentIdentifier;
		range: Range;
	}

	export const type = new RequestType<Params, Promise<CSPost | undefined>, void, void>(
		"codeStream/textDocument/post"
	);
}

export namespace DidReceivePubNubMessagesNotification {
	export interface Params {
		[key: string]: any;
	}

	export const type = new NotificationType<Params[], void>("codeStream/didReceivePubNubMessages");
}
