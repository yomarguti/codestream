import { createSelector } from "reselect";
import { toMapBy } from "../../utils";
import { ActionType, Index } from "../common";
import * as actions from "./actions";
import { ReviewsActionsTypes, ReviewsState } from "./types";
import { CSReview } from "@codestream/protocols/api";
import { CodeStreamState } from "..";

type ReviewsActions = ActionType<typeof actions>;

const initialState: ReviewsState = { bootstrapped: false, reviews: {} };

export function reduceReviews(state = initialState, action: ReviewsActions): ReviewsState {
	switch (action.type) {
		case ReviewsActionsTypes.Bootstrap:
			return {
				bootstrapped: true,
				reviews: { ...state.reviews, ...toMapBy("id", action.payload) }
			};
		case ReviewsActionsTypes.AddReviews:
		case ReviewsActionsTypes.UpdateReviews:
		case ReviewsActionsTypes.SaveReviews: {
			return {
				bootstrapped: state.bootstrapped,
				reviews: { ...state.reviews, ...toMapBy("id", action.payload) }
			};
		}
		case ReviewsActionsTypes.Delete: {
			const nextReviews = { ...state.reviews };
			delete nextReviews[action.payload];
			return { bootstrapped: state.bootstrapped, reviews: nextReviews };
		}
		case "RESET":
			return initialState;
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

const getReviews = (state: CodeStreamState) => state.reviews.reviews;

export const getAllReviews = createSelector(getReviews, (reviews: Index<CSReview>) =>
	Object.values(reviews)
);

export const teamHasReviews = createSelector(getReviews, (reviews: Index<CSReview>) => {
	return Object.keys(reviews).length > 0;
});
