"use strict";
import { RequestType, TextDocumentIdentifier } from "vscode-languageserver-protocol";
import {
	CreateMarkerRequest,
	CrossPostIssueValues,
	GetRangeScmInfoResponse,
	PostPlus,
	ThirdPartyProviderUser
} from "./agent.protocol";
import {
	CSChannelStream,
	CSCreateReviewRequest,
	CSDirectStream,
	CSLocationArray,
	CSMarker,
	CSMarkerLocations,
	CSReferenceLocation,
	CSRepoChangeset,
	CSRepository,
	CSReview,
	CSStream
} from "./api.protocol";

export interface ReviewPlus extends CSReview {
	markers?: CSMarker[];
}

export interface CreateReviewRequest extends Omit<CSCreateReviewRequest, "teamId"> {
	// repoChangeset?: CreateRepoChangesetRequest[];
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

export interface ShareableReviewAttributes extends Omit<CreateReviewRequest, "markers"> {
	codeBlocks?: GetRangeScmInfoResponse[];
}

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
	streamId?: string;
	before?: number;
	byLastAcivityAt?: boolean;
}
export interface FetchReviewsResponse {
	reviews: ReviewPlus[];
	markers?: CSMarker[];
}
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
	id: string;
	sortByActivity?: boolean;
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
