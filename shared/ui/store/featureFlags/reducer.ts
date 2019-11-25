import { FeatureFlagsState, FeatureFlagsActionType } from "./types";
import * as actions from "./actions";
import { ActionType } from "../common";

type FeatureFlagsAction = ActionType<typeof actions>;

const initialState: FeatureFlagsState = { sharing: true };

export function reduceFeatureFlags(state = initialState, action: FeatureFlagsAction) {
	switch (action.type) {
		case FeatureFlagsActionType.SetFlag:
			return { ...state, [action.payload.flag]: action.payload.value };
		default:
			return state;
	}
}
