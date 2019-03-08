"use strict";
import { Range, RequestType, TextDocumentIdentifier } from "vscode-languageserver-protocol";
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

export interface CodemarkPlus extends CSCodemark {
	markers?: CSMarker[];
}

export interface FetchCodemarksRequest {
	streamId?: string;
}

export interface FetchCodemarksResponse {
	codemarks: CodemarkPlus[];
	markers?: CSMarker[];
}

export const FetchCodemarksRequestType = new RequestType<
	FetchCodemarksRequest,
	FetchCodemarksResponse | undefined,
	void,
	void
>("codestream/fetchCodemarks");

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
>("codestream/markerLocations/create");

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
>("codestream/marker/locations");

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
>("codestream/markers");

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
>("codestream/marker");

export interface UpdateMarkerRequest {
	markerId: string;
	commitHashWhenCreated?: string;
}

export interface UpdateMarkerResponse {
	marker: CSMarker;
}

export const UpdateMarkerRequestType = new RequestType<
	UpdateMarkerRequest,
	UpdateMarkerResponse,
	void,
	void
>("codestream/marker/update");

export interface CreateCodemarkRequest {
	type: CodemarkType;
	providerType?: ProviderType;
	text?: string;
	streamId?: string;
	postId?: string;
	parentPostId?: string;
	color?: string;
	status?: string;
	title?: string;
	assignees?: string[];
	markers?: CreateCodemarkRequestMarker[];
	remotes?: string[];
	externalProvider?: string;
	externalProviderUrl?: string;
	externalAssignees?: { displayName: string }[];
}

export interface CreateCodemarkRequestMarker {
	code: string;
	remotes?: string[];
	file?: string;
	commitHash?: string;
	location?: CSLocationArray;
}

export interface DeleteCodemarkRequest {
	codemarkId: string;
}

export interface DeleteCodemarkResponse {}

export interface SetCodemarkPinnedRequest {
	codemarkId: string;
	value: boolean;
}

export interface SetCodemarkPinnedResponse {}

export const SetCodemarkPinnedRequestType = new RequestType<
	SetCodemarkPinnedRequest,
	SetCodemarkPinnedResponse,
	void,
	void
>("codestream/codemark/setPinned");

export interface SetCodemarkStatusRequest {
	codemarkId: string;
	status: string;
}

export interface SetCodemarkStatusResponse {
	codemark: CodemarkPlus;
}

export const SetCodemarkStatusRequestType = new RequestType<
	SetCodemarkStatusRequest,
	SetCodemarkStatusResponse,
	void,
	void
>("codestream/codemark/setStatus");

export interface UpdateCodemarkRequest {
	codemarkId: string;
	streamId?: string;
	postId?: string;
	parentPostId?: string;
	color?: string;
	status?: string;
	assignees?: string[];
	title?: string;
	text?: string;
}

export interface UpdateCodemarkResponse {
	codemark: CodemarkPlus;
}

export const UpdateCodemarkRequestType = new RequestType<
	UpdateCodemarkRequest,
	UpdateCodemarkResponse,
	void,
	void
>("codestream/codemark/update");
