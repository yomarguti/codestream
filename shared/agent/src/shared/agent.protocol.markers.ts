"use strict";
import {
	NotificationType,
	Range,
	RequestType,
	TextDocumentIdentifier
} from "vscode-languageserver-protocol";
import {
	CodemarkType,
	CSCodemark,
	CSLocationArray,
	CSMarker,
	CSMarkerLocation,
	CSMarkerLocations,
	CSPost,
	ProviderType
} from "./api.protocol";

export interface CSFullCodemark extends CSCodemark {
	markers?: CSMarker[];
}

export interface DidChangeDocumentMarkersNotification {
	textDocument: TextDocumentIdentifier;
}

export const DidChangeDocumentMarkersNotificationType = new NotificationType<
	DidChangeDocumentMarkersNotification,
	void
>("codeStream/didChangeDocumentMarkers");

export interface FetchCodemarksRequest {
	streamId?: string;
}

export interface FetchCodemarksResponse {
	codemarks: CSFullCodemark[];
	markers?: CSMarker[];
}

export const FetchCodemarksRequestType = new RequestType<
	FetchCodemarksRequest,
	FetchCodemarksResponse | undefined,
	void,
	void
>("codeStream/fetchCodemarks");

export interface GetCodemarkRequest {
	codemarkId: string;
}

export interface GetCodemarkResponse {
	codemark: CSCodemark;
	post: CSPost;
	markers: CSMarker[];
}

export interface CreateMarkerLocationRequest {
	streamId: string;
	commitHash: string;
	locations: {
		[id: string]: CSLocationArray;
	};
}

export interface CreateMarkerLocationResponse {}

export const CreateMarkerLocationRequestType = new RequestType<
	CreateMarkerLocationRequest,
	CreateMarkerLocationResponse,
	void,
	void
>("codeStream/markerLocations/create");

export interface DocumentMarkersRequest {
	textDocument: TextDocumentIdentifier;
}

export interface CSFullMarker extends CSMarker {
	range: Range;
	codemark: CSCodemark;
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
	markers: CSFullMarker[];
	markersNotLocated: MarkerNotLocated[];
}

export const DocumentMarkersRequestType = new RequestType<
	DocumentMarkersRequest,
	DocumentMarkersResponse | undefined,
	void,
	void
>("codeStream/textDocument/markers");

export interface FetchMarkerLocationsRequest {
	streamId: string;
	commitHash: string;
}

export interface FetchMarkerLocationsResponse {
	markerLocations: CSMarkerLocations;
}

export const FetchMarkerLocationsRequestType = new RequestType<
	FetchMarkerLocationsRequest,
	FetchMarkerLocationsResponse,
	void,
	void
>("codeStream/marker/locations");

export interface FetchMarkersRequest {
	streamId: string;
	commitHash?: string;
	markerIds?: string[];
}

export interface FetchMarkersResponse {
	markers: CSMarker[];
	markerLocations: CSMarkerLocation[];
	codemarks: CSCodemark[];
}

export const FetchMarkersRequestType = new RequestType<
	FetchMarkersRequest,
	FetchMarkersResponse,
	void,
	void
>("codeStream/markers");

export interface GetMarkerRequest {
	markerId: string;
}

export interface GetMarkerResponse {
	marker: CSMarker;
}

export const GetMarkerRequestType = new RequestType<
	GetMarkerRequest,
	GetMarkerResponse,
	void,
	void
>("codeStream/marker");

export interface UpdateMarkerRequest {
	markerId: string;
	commitHashWhenCreated?: string;
}

export interface CreateCodemarkRequest {
	type: CodemarkType;
	providerType?: ProviderType;
	text?: string;
	streamId?: string;
	postId?: string;
	color?: string;
	status?: string;
	title?: string;
	assignees?: string[];
	markers?: CreateCodemarkRequestMarker[];
	remotes?: string[];
}

export interface CreateCodemarkRequestMarker {
	code: string;
	remotes?: string[];
	file?: string;
	commitHash?: string;
	location?: CSLocationArray;
}

export interface UpdateCodemarkRequest {
	codemarkId: string;
	streamId?: string;
	postId?: string;
	color?: string;
}

export interface UpdateCodemarkResponse {
	codemark: CSFullCodemark;
}

export const UpdateCodemarkRequestType = new RequestType<
	UpdateCodemarkRequest,
	UpdateCodemarkResponse,
	void,
	void
>("codeStream/codemark/update");

export interface DeleteCodemarkRequest {
	codemarkId: string;
}

export interface DeleteCodemarkResponse {}

export interface UpdateMarkerResponse {
	marker: CSMarker;
}

export const UpdateMarkerRequestType = new RequestType<
	UpdateMarkerRequest,
	UpdateMarkerResponse,
	void,
	void
>("codeStream/marker/update");
