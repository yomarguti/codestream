"use strict";
import { RequestType } from "vscode-languageserver-protocol";
import {
	CSCodemark,
	CSLocationArray,
	CSMarker,
	CSMarkerLocation,
	CSMarkerLocations
} from "./api.protocol";

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
