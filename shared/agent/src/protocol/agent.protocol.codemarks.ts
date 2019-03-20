"use strict";
import { RequestType } from "vscode-languageserver-protocol";
import {
	CodemarkType,
	CSCodemark,
	CSLocationArray,
	CSMarker,
	CSMarkerLocations,
	CSRepository,
	CSStream,
	ProviderType
} from "./api.protocol";

export interface CodemarkPlus extends CSCodemark {
	markers?: CSMarker[];
}

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
	remoteCodeUrl?: { name: string; url: string };
	createPermalink?: false | "public" | "private";
}
export interface CreateCodemarkRequestMarker {
	code: string;
	remotes?: string[];
	file?: string;
	commitHash?: string;
	location?: CSLocationArray;
}
export interface CreateCodemarkResponse {
	codemark: CSCodemark;
	markers?: CSMarker[];
	markerLocations?: CSMarkerLocations[];
	streams?: CSStream[];
	repos?: CSRepository[];
	permalink?: string;
}
export const CreateCodemarkRequestType = new RequestType<
	CreateCodemarkRequest,
	CreateCodemarkResponse,
	void,
	void
>("codestream/codemarks/create");

export interface CreateCodemarkPermalinkRequest {
	codemarkId: string;
	isPublic: boolean;
}
export interface CreateCodemarkPermalinkResponse {
	permalink: string;
}
export const CreateCodemarkPermalinkRequestType = new RequestType<
	CreateCodemarkPermalinkRequest,
	CreateCodemarkPermalinkResponse,
	void,
	void
>("codestream/codemark/permalink");

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
>("codestream/codemarks");

export interface DeleteCodemarkRequest {
	codemarkId: string;
}
export interface DeleteCodemarkResponse {}
export const DeleteCodemarkRequestType = new RequestType<
	DeleteCodemarkRequest,
	DeleteCodemarkResponse,
	void,
	void
>("codestream/codemark/delete");

export interface GetCodemarkRequest {
	codemarkId: string;
}

export interface GetCodemarkResponse {
	codemark: CSCodemark;
}

export const GetCodemarkRequestType = new RequestType<
	GetCodemarkRequest,
	GetCodemarkResponse,
	void,
	void
>("codestream/codemark");

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
