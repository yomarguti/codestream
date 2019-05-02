"use strict";
import { Range, RequestType, TextDocumentIdentifier } from "vscode-languageserver-protocol";
import { CodemarkPlus } from "./agent.protocol.codemarks";
import { CSMarker } from "./api.protocol";

export interface CreateDocumentMarkerPermalinkRequest {
	range: Range;
	uri: string;
	privacy: "public" | "private";
	contents?: string;
}

export interface CreateDocumentMarkerPermalinkResponse {
	linkUrl: string;
}

export const CreateDocumentMarkerPermalinkRequestType = new RequestType<
	CreateDocumentMarkerPermalinkRequest,
	CreateDocumentMarkerPermalinkResponse,
	void,
	void
>("codestream/textDocument/markers/create/link");

export interface DocumentMarker extends CSMarker {
	codemark: CodemarkPlus;
	creatorName: string;
	range: Range;
	summary: string;
	summaryMarkdown: string;
}

export enum MarkerNotLocatedReason {
	MISSING_ORIGINAL_LOCATION = "missing original location",
	MISSING_ORIGINAL_COMMIT = "missing original commit",
	CODEBLOCK_DELETED = "code block deleted",
	UNKNOWN = "unknown"
}

export interface MarkerNotLocated extends CSMarker {
	notLocatedReason: MarkerNotLocatedReason;
	notLocatedDetails?: string;
}

export interface FetchDocumentMarkersRequest {
	textDocument: TextDocumentIdentifier;
	filters?: {
		excludeArchived?: boolean
	};
}
export interface FetchDocumentMarkersResponse {
	markers: DocumentMarker[];
	markersNotLocated: MarkerNotLocated[];
}
export const FetchDocumentMarkersRequestType = new RequestType<
	FetchDocumentMarkersRequest,
	FetchDocumentMarkersResponse | undefined,
	void,
	void
>("codestream/textDocument/markers");

export interface GetDocumentFromKeyBindingRequest {
	key: number;
}
export interface GetDocumentFromKeyBindingResponse {
	textDocument: TextDocumentIdentifier;
	range: Range;
	marker: CSMarker;
}
export const GetDocumentFromKeyBindingRequestType = new RequestType<
	GetDocumentFromKeyBindingRequest,
	GetDocumentFromKeyBindingResponse | undefined,
	void,
	void
>("codestream/textDocument/fromKey");

export interface GetDocumentFromMarkerRequest {
	markerId: string;
	file?: string;
	repoId?: string;
}
export interface GetDocumentFromMarkerResponse {
	textDocument: TextDocumentIdentifier;
	range: Range;
	marker: CSMarker;
}
export const GetDocumentFromMarkerRequestType = new RequestType<
	GetDocumentFromMarkerRequest,
	GetDocumentFromMarkerResponse | undefined,
	void,
	void
>("codestream/textDocument/fromMarker");
