import { ActionType } from "../common";
import * as actions from "./actions";
import { ContextActionsType, State } from "./types";

type ContextActions = ActionType<typeof actions>;

const initialState: State = {
	currentFile: "",
	mostRecentSourceFile: "",
	currentTeamId: "",
	currentCommit: "", // maybe delete
	currentStreamId: "",
	threadId: null,
	panelStack: ["channels"],
	hasFocus: true, // we assume we start with the focus when codestream initializes
	codemarkFileFilter: "all",
	codemarkTypeFilter: "all",
	channelFilter: "all"
};

export function reduceContext(state: State = initialState, action: ContextActions) {
	switch (action.type) {
		case ContextActionsType.SetContext:
			return { ...state, ...action.payload };
		case ContextActionsType.SetCurrentFile: {
			const file = action.payload;
			if (file) return { ...state, currentFile: file, mostRecentSourceFile: file };
			else return { ...state, currentFile: "" };
		}
		case ContextActionsType.SetCurrentStream:
			return { ...state, currentStreamId: action.payload, threadId: null };
		case ContextActionsType.SetThread: {
			return { ...state, ...action.payload };
		}
		case ContextActionsType.OpenPanel:
			return { ...state, panelStack: [action.payload, ...state.panelStack].slice(0, 10) };
		case ContextActionsType.ClosePanel: {
			if (state.panelStack.length === 1) return state;
			const [, ...panelStack] = state.panelStack;
			return { ...state, panelStack };
		}
		case ContextActionsType.SetFocusState:
			return { ...state, hasFocus: action.payload };
		case ContextActionsType.SetCodeMarkFileFilter:
			return { ...state, codemarkFileFilter: action.payload };
		case ContextActionsType.SetCodemarkTypeFilter:
			return { ...state, codemarkTypeFilter: action.payload };
		case ContextActionsType.SetChannelFilter:
			return { ...state, channelFilter: action.payload };
		default:
			return { ...initialState, ...state };
	}
}
