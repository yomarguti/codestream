import { createSelector } from "reselect";
import { CSCodemark } from "../../shared/api.protocol";
import { toMapBy } from "../../utils";
import { ActionType } from "../common";
import * as actions from "./actions";
import { CodemarksActionsTypes } from "./types";

type StreamsActions = ActionType<typeof actions>;

interface State {
	[codemarkId: string]: CSCodemark;
}

const initialState: State = {};

export function reduceCodemarks(state = initialState, { type, payload }: StreamsActions) {
	switch (type) {
		case CodemarksActionsTypes.AddCodemarks:
		case CodemarksActionsTypes.UpdateCodemarks:
		case CodemarksActionsTypes.SaveCodemarks: {
			return { ...state, ...toMapBy("id", payload) };
		}
		default:
			return state;
	}
}

export function getCodemark(state: State, id?: string): CSCodemark | undefined {
	if (!id) return undefined;
	return state[id];
}

export function getByType(state: State, type?: string): CSCodemark[] {
	if (!type) return Object.values(state);

	return Object.values(state).filter(codemark => codemark.type === type);
}

const getCodemarks = state => state.codemarks;
const getCodemarkTypeFilter = state => state.context.codemarkTypeFilter;
export const getTypeFilteredCodemarks = createSelector(
	getCodemarks,
	getCodemarkTypeFilter,
	(codemarks: State, filter: string) => {
		if (filter === "all") return Object.values(codemarks);
		else {
			return Object.values(codemarks).filter(
				codemark => codemark.type === filter && !codemark.deactivated
			);
		}
	}
);

export const teamHasCodemarks = createSelector(getCodemarks, (codemarks: State) => {
	return Object.keys(codemarks).length > 0;
});
