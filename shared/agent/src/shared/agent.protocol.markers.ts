"use strict";
import {
	NotificationType,
	Range,
	RequestType,
	TextDocumentIdentifier
} from "vscode-languageserver-protocol";
import { CSMarker, CSMarkerLocations } from "./api.protocol";

export interface DidChangeDocumentMarkersNotificationResponse {
	textDocument: TextDocumentIdentifier;
}

export const DidChangeDocumentMarkersNotificationType = new NotificationType<
	DidChangeDocumentMarkersNotificationResponse,
	void
>("codeStream/didChangeDocumentMarkers");

export interface DocumentMarkersRequest {
	textDocument: TextDocumentIdentifier;
}

export interface MarkerWithRange extends CSMarker {
	range: Range;
}

export interface DocumentMarkersResponse {
	markers: MarkerWithRange[];
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
