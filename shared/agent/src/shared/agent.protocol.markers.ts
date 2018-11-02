"use strict";
import {
	NotificationType,
	Range,
	RequestType,
	TextDocumentIdentifier
} from "vscode-languageserver-protocol";
import { CSLocationArray, CSMarker, CSMarkerLocation, CSMarkerLocations } from "./api.protocol";

export interface DidChangeDocumentMarkersNotification {
	textDocument: TextDocumentIdentifier;
}

export const DidChangeDocumentMarkersNotificationType = new NotificationType<
	DidChangeDocumentMarkersNotification,
	void
>("codeStream/didChangeDocumentMarkers");

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

export interface MarkerWithRange extends CSMarker {
	range: Range;
}

export enum MarkerNotLocatedReason {
	MISSING_ORIGINAL_LOCATION,
	MISSING_ORIGINAL_COMMIT,
	CODEBLOCK_DELETED,
	UNKNOWN
}

export interface MarkerNotLocated extends CSMarker {
	notLocatedReason: MarkerNotLocatedReason;
	notLocatedDetails?: string;
}

export interface DocumentMarkersResponse {
	markers: MarkerWithRange[];
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
	numMarkers: number;
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

export interface CreateMarkerRequest {
	providerType: string;
	postStreamId: string;
	postId: string;
	streamId?: string;
	file?: string;
	repoId?: string;
	remotes?: string[];
	commitHash?: string;
	code: string;
	location?: CSLocationArray;
	type?: string;
	color?: string;
	status?: string;
}

export interface UpdateMarkerResponse {
	marker: CSMarker;
}

export const UpdateMarkerRequestType = new RequestType<
	UpdateMarkerRequest,
	UpdateMarkerResponse,
	void,
	void
>("codeStream/marker/update");
