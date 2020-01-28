import { ReviewPlus } from "@codestream/protocols/agent";

export enum ReviewsActionsTypes {
	AddReviews = "ADD_REVIEWS",
	SaveReviews = "SAVE_REVIEWS",
	UpdateReviews = "UPDATE_REVIEWS",
	Delete = "DELETE_REVIEW"
}

export interface ReviewsState {
	[reviewId: string]: ReviewPlus;
}
