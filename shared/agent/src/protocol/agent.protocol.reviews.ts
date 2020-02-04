"use strict";
import { RequestType, TextDocumentIdentifier } from "vscode-languageserver-protocol";
import { CreateMarkerRequest, PostPlus, ThirdPartyProviderUser } from "./agent.protocol";
import {
	CSChannelStream,
	CSCreateReviewRequest,
	CSDirectStream,
	CSMarker,
	CSMarkerLocations,
	CSRepoChangeset,
	CSRepository,
	CSReview,
	CSStream,
	CSGetReviewsResponse
} from "./api.protocol";

export interface ReviewPlus extends CSReview {
	markers?: CSMarker[];
}

export interface CreateReviewRequest extends Omit<CSCreateReviewRequest, "teamId"> {
	repoChangeset?: CSRepoChangeset[];
	markers?: CreateMarkerRequest[];
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
	FetchReviewsResponse | undefined,
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

export interface UpdateReviewRequest {
	id: string;
	streamId?: string;
	postId?: string;
	parentPostId?: string;
	color?: string;
	status?: string;
	assignees?: string[];
	title?: string;
	text?: string;
	externalAssignees?: ThirdPartyProviderUser[];
	externalProvider?: string;
	externalProviderHost?: string;
	externalProviderUrl?: string;
	wantEmailNotification?: boolean;
}
export interface UpdateReviewResponse {
	review: ReviewPlus;
}
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
