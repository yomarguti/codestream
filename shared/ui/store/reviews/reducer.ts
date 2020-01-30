import { createSelector } from "reselect";
import { toMapBy } from "../../utils";
import { ActionType } from "../common";
import * as actions from "./actions";
import { ReviewsActionsTypes, ReviewsState } from "./types";
import { ReviewPlus } from "@codestream/protocols/agent";

type ReviewsActions = ActionType<typeof actions>;

const initialState: ReviewsState = {};

export function reduceReviews(state = initialState, action: ReviewsActions) {
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
			return initialState;
		default:
			return state;
	}
}

export function getReview(state: ReviewsState, id?: string): ReviewPlus | undefined {
	if (!id) return undefined;
	return state[id];
}

export function getByStatus(state: ReviewsState, status?: string): ReviewPlus[] {
	if (!status) return Object.values(state);

	return Object.values(state).filter(review => review.status === status);
}

const getReviews = state => state.reviews;

export const teamHasReviews = createSelector(getReviews, (reviews: ReviewsState) => {
	return Object.keys(reviews).length > 0;
});
