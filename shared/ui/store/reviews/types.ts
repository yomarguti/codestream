import { CSReview, CSReviewChangeset } from "@codestream/protocols/api";
import { Index } from "../common";

export enum ReviewsActionsTypes {
	AddReviews = "ADD_REVIEWS",
	SaveReviews = "@reviews/SaveReviews",
	UpdateReviews = "@reviews/UpdateReviews",
	Delete = "@reviews/Delete",
	SaveChangesetsForReview = "@reviews/SaveChangesets"
}

export type ReviewsDictionary = Index<CSReview>;
export type ChangesetsDictionary = Index<CSReviewChangeset[]>;

export interface ReviewsState {
	reviews: ReviewsDictionary;
	changesets: ChangesetsDictionary;
}
