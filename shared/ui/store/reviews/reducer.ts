import { createSelector } from "reselect";
import { toMapBy } from "../../utils";
import { ActionType } from "../common";
import * as actions from "./actions";
import { ReviewsActionsTypes, ReviewsState, ReviewsDictionary } from "./types";
import { combineReducers } from "redux";
import { CSReview, CSReviewChangeset } from "@codestream/protocols/api";
import { CodeStreamState } from "..";

type ReviewsActions = ActionType<typeof actions>;

function reduceReviews(state = {}, action: ReviewsActions) {
	switch (action.type) {
		case ReviewsActionsTypes.AddReviews:
		case ReviewsActionsTypes.UpdateReviews:
		case ReviewsActionsTypes.SaveReviews: {
			return { ...state, ...toMapBy("id", action.payload) };
		}
		case ReviewsActionsTypes.Delete: {
			const nextState = { ...state };
			delete nextState[action.payload];
			return nextState;
		}
		case "RESET":
			return {};
		default:
			return state;
	}
}

function reduceChangesets(state = {}, action: ReviewsActions) {
	switch (action.type) {
		case ReviewsActionsTypes.SaveChangesetsForReview:
			const { reviewId, changesets } = action.payload;
			return { ...state, [reviewId]: changesets };
		case "RESET":
			return {};
		default:
			return state;
	}
}

export const reduceReviewsState = combineReducers({
	reviews: reduceReviews,
	changesets: reduceChangesets
});

export function getReview(state: ReviewsState, id: string): CSReview | undefined {
	return state.reviews[id];
}

export function getChangesets(
	state: ReviewsState,
	reviewId: string
): CSReviewChangeset[] | undefined {
	return state.changesets[reviewId];
}

export function getByStatus(state: CodeStreamState, status?: string): CSReview[] {
	if (!status) return getAllReviews(state);

	return getAllReviews(state).filter(review => review.status === status);
}

const getReviews = (state: CodeStreamState) => state.reviews.reviews;

export const getAllReviews = createSelector(getReviews, (reviews: ReviewsDictionary) =>
	Object.values(reviews)
);

export const teamHasReviews = createSelector(getReviews, (reviews: ReviewsDictionary) => {
	return Object.keys(reviews).length > 0;
});
