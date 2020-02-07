import { CSReview } from "@codestream/protocols/api";
import { Index } from "../common";

export enum ReviewsActionsTypes {
	AddReviews = "ADD_REVIEWS",
	SaveReviews = "@reviews/SaveReviews",
	UpdateReviews = "@reviews/UpdateReviews",
	Delete = "@reviews/Delete",
}

export type ReviewsState = Index<CSReview>;
