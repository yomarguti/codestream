import { createSelector } from "reselect";
import { toMapBy } from "../../utils";
import { ActionType } from "../common";
import * as actions from "./actions";
import { ReviewsActionsTypes, ReviewsState } from "./types";
import { CSReview } from "@codestream/protocols/api";
import { CodeStreamState } from "..";

type ReviewsActions = ActionType<typeof actions>;

export function reduceReviews(state = {}, action: ReviewsActions) {
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

export function getReview(state: ReviewsState, id: string): CSReview | undefined {
	return state.reviews[id];
}

export function getByStatus(state: CodeStreamState, status?: string): CSReview[] {
	if (!status) return getAllReviews(state);

	return getAllReviews(state).filter(review => review.status === status);
}

const getReviews = (state: CodeStreamState) => state.reviews;

export const getAllReviews = createSelector(getReviews, (reviews: ReviewsState) =>
	Object.values(reviews)
);

export const teamHasReviews = createSelector(getReviews, (reviews: ReviewsState) => {
	return Object.keys(reviews).length > 0;
});
