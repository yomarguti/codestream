"use strict";
import { RequestType, TextDocumentIdentifier } from "vscode-languageserver-protocol";
import { CreateMarkerRequest, PostPlus, ThirdPartyProviderUser } from "./agent.protocol";
import {
	CSChannelStream,
	CSCreateReviewRequest,
	CSDirectStream,
	CSGetReviewDiffsRequest,
	CSGetReviewDiffsResponse,
	CSGetReviewsResponse,
	CSMarker,
	CSMarkerLocations,
	CSRepository,
	CSReview,
	CSReviewChangesetBase,
	CSStream,
	CSUpdateReviewRequest,
	CSUpdateReviewResponse
} from "./api.protocol";
import { CSReviewDiffs } from "./api.protocol.models";

export interface ReviewPlus extends CSReview {}

export interface CreateDiffsRequest extends CSReviewDiffs {}
export interface CreateReviewChangesetsRequest
	extends Omit<CSReviewChangesetBase, "reviewId" | "repoId" | "diffId"> {
	repoId: string;
	diffs: CreateDiffsRequest;
}

export interface CreateReviewRequest extends Omit<CSCreateReviewRequest, "teamId"> {
	markers?: CreateMarkerRequest[];
	reviewChangesets?: CreateReviewChangesetsRequest[];
}

export interface CreateReviewResponse {
	review: CSReview;
	markers?: CSMarker[];
	markerLocations?: CSMarkerLocations[];
	streams?: CSStream[];
	repos?: CSRepository[];
}
export const CreateReviewRequestType = new RequestType<
	CreateReviewRequest,
	CreateReviewResponse,
	void,
	void
>("codestream/reviews/create");

export interface ShareableReviewAttributes extends Omit<CreateReviewRequest, "markers"> {}

export interface CreateShareableReviewRequest {
	attributes: ShareableReviewAttributes;
	memberIds?: string[];
	textDocuments?: TextDocumentIdentifier[];
	entryPoint?: string;
	mentionedUserIds?: string[];
}

export interface CreateShareableReviewResponse {
	review: ReviewPlus;
	post: PostPlus;
	stream: CSDirectStream | CSChannelStream;
	markerLocations?: CSMarkerLocations[];
}

export const CreateShareableReviewRequestType = new RequestType<
	CreateShareableReviewRequest,
	CreateShareableReviewResponse,
	void,
	void
>("codestream/reviews/create");

export interface FetchReviewsRequest {
	reviewIds?: string[];
	streamId?: string;
	before?: number;
	byLastAcivityAt?: boolean;
}

// TODO: when the server starts returning the markers, this response should have ReviewPlus objects
export type FetchReviewsResponse = Pick<CSGetReviewsResponse, "reviews">;

export const FetchReviewsRequestType = new RequestType<
	FetchReviewsRequest,
	FetchReviewsResponse,
	void,
	void
>("codestream/reviews");

export interface DeleteReviewRequest {
	id: string;
}
export interface DeleteReviewResponse {}
export const DeleteReviewRequestType = new RequestType<
	DeleteReviewRequest,
	DeleteReviewResponse,
	void,
	void
>("codestream/review/delete");

export interface GetReviewRequest {
	reviewId: string;
}

export interface GetReviewResponse {
	review: CSReview;
}

export const GetReviewRequestType = new RequestType<
	GetReviewRequest,
	GetReviewResponse,
	void,
	void
>("codestream/review");

export interface SetReviewStatusRequest {
	id: string;
	status: string;
}
export interface SetReviewStatusResponse {
	review: ReviewPlus;
}
export const SetReviewStatusRequestType = new RequestType<
	SetReviewStatusRequest,
	SetReviewStatusResponse,
	void,
	void
>("codestream/review/setStatus");

export interface UpdateReviewRequest extends CSUpdateReviewRequest {
	id: string;
}

export interface UpdateReviewResponse extends CSUpdateReviewResponse {}

export const UpdateReviewRequestType = new RequestType<
	UpdateReviewRequest,
	UpdateReviewResponse,
	void,
	void
>("codestream/review/update");

export interface FollowReviewRequest {
	id: string;
	value: boolean;
}
export interface FollowReviewResponse {}
export const FollowReviewRequestType = new RequestType<
	FollowReviewRequest,
	FollowReviewResponse,
	void,
	void
>("codestream/review/follow");

export interface GetReviewContentsRequest {
	reviewId: string;
	repoId: string;
	path: string;
}

export interface GetReviewContentsResponse {
	base: string;
	head: string;
}

export const GetReviewContentsRequestType = new RequestType<
	GetReviewContentsRequest,
	GetReviewContentsResponse,
	void,
	void
>("codestream/review/contents");

export interface FetchReviewDiffsRequest extends CSGetReviewDiffsRequest {}

export interface FetchReviewDiffsResponse extends CSGetReviewDiffsResponse {}

export const FetchReviewDiffsRequestType = new RequestType<
	FetchReviewDiffsRequest,
	FetchReviewDiffsResponse,
	void,
	void
>("codestream/review/diffs");

export interface CheckReviewPreconditionsRequest {
	reviewId: string;
}

export interface CheckReviewPreconditionsResponse {
	success: boolean;
	error?: string;
}

export const CheckReviewPreconditionsRequestType = new RequestType<
	StartReviewRequest,
	StartReviewResponse,
	void,
	void
>("codestream/review/checkPreconditions");

export interface StartReviewRequest {
	reviewId: string;
}

export interface StartReviewResponse {
	success: boolean;
	error?: string;
}

export const StartReviewRequestType = new RequestType<
	StartReviewRequest,
	StartReviewResponse,
	void,
	void
>("codestream/review/start");

export interface PauseReviewRequest {
	reviewId: string;
}

export interface PauseReviewResponse {
	success: boolean;
	error?: string;
}

export const PauseReviewRequestType = new RequestType<
	PauseReviewRequest,
	PauseReviewResponse,
	void,
	void
>("codestream/review/pause");

export interface EndReviewRequest {
	reviewId: string;
}

export interface EndReviewResponse {
	success: boolean;
	error?: string;
}

export const EndReviewRequestType = new RequestType<
	EndReviewRequest,
	EndReviewResponse,
	void,
	void
>("codestream/review/end");
