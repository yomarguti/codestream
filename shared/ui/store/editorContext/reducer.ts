import { State, EditorContextActionsType } from "./types";
import * as actions from "./actions";
import { ActionType } from "../common";
import { createSelector } from "reselect";

type EditorContextActions = ActionType<typeof actions>;

const initialState: State = {
	activeFile: "",
	lastActiveFile: "", // is this still necessary?
	textEditorVisibleRanges: [],
	textEditorUri: "",
	textEditorSelections: [],
	metrics: undefined,
	scm: undefined
};

export function reduceEditorContext(state = initialState, action: EditorContextActions) {
	switch (action.type) {
		case EditorContextActionsType.SetCurrentFile: {
			const file = action.payload;
			const nextState: Partial<State> = {
				activeFile: file
			};
			if (file) {
				nextState.lastActiveFile = file;
			}
			return { ...state, ...nextState };
		}
		case EditorContextActionsType.SetEditorContext: {
			return { ...state, ...action.payload };
		}
		case "RESET":
			return initialState;
		default:
			return state;
	}
}

const emptyArray = [];
export const getCurrentSelection = createSelector(
	(state: State) => state.textEditorSelections || emptyArray,
	selections => selections[0]
);
