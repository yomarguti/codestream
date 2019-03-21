"use strict";
import { Range, RequestType, TextDocumentIdentifier } from "vscode-languageserver-protocol";
import { CSCodemark, CSMarker } from "./api.protocol";

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

export interface DocumentMarkersRequest {
	textDocument: TextDocumentIdentifier;
}

export interface DocumentMarker extends CSMarker {
	codemark: CSCodemark;
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

export interface DocumentMarkersResponse {
	markers: DocumentMarker[];
	markersNotLocated: MarkerNotLocated[];
}

export const DocumentMarkersRequestType = new RequestType<
	DocumentMarkersRequest,
	DocumentMarkersResponse | undefined,
	void,
	void
>("codestream/textDocument/markers");
