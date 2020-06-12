import { ActionType } from "../common";
import * as actions from "./actions";
import { IdeActionType, IdeState } from "./types";

type IdeActions = ActionType<typeof actions>;

const initialState: IdeState = { name: undefined };

export function reduceIde(state = initialState, action: IdeActions) {
	switch (action.type) {
		case IdeActionType.Set:
			return { ...state, ...action.payload };
		default:
			return state;
	}
}
