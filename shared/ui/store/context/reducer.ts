import { ActionType } from "../common";
import * as actions from "./actions";
import { ContextActionsType, State } from "./types";

type ContextActions = ActionType<typeof actions>;

const initialState: State = {
	activeFile: "",
	lastActiveFile: "",
	currentTeamId: "",
	currentCommit: "", // maybe delete
	currentStreamId: "",
	fileStreamId: undefined,
	lastFileStreamId: undefined,
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
			const { file, fileStreamId } = action.payload;
			const nextState: Partial<State> = { activeFile: file, fileStreamId };
			if (file) {
				nextState.lastActiveFile = file;
			}
			if (fileStreamId) {
				nextState.lastFileStreamId = fileStreamId;
			}
			return { ...state, ...nextState };
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
		case "RESET":
			return initialState;
		default:
			return { ...initialState, ...state };
	}
}
