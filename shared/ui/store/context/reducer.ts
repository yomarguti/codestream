import { ActionType } from "../common";
import * as preferencesActions from "../preferences/actions";
import { PreferencesActionsType } from "../preferences/types";
import * as actions from "./actions";
import { ContextActionsType, State } from "./types";

type ContextActions = ActionType<typeof actions>;
type PreferencesActions = ActionType<typeof preferencesActions>;

const initialState: State = {
	currentTeamId: "",
	currentStreamId: "",
	issueProvider: undefined,
	threadId: undefined,
	panelStack: ["channels"],
	hasFocus: true, // we assume we start with the focus when codestream initializes
	codemarkFileFilter: "all",
	codemarkTypeFilter: "all",
	codemarkColorFilter: "all",
	channelFilter: "all"
};

export function reduceContext(
	state: State = initialState,
	action: ContextActions | PreferencesActions
) {
	switch (action.type) {
		case ContextActionsType.SetContext:
			return { ...state, ...action.payload };
		case ContextActionsType.SetCurrentStream: {
			const { streamId, threadId } = action.payload;
			return { ...state, currentStreamId: streamId, threadId };
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
		case ContextActionsType.SetCodemarkFileFilter:
			return { ...state, codemarkFileFilter: action.payload };
		case ContextActionsType.SetCodemarkTypeFilter:
			return { ...state, codemarkTypeFilter: action.payload };
		case ContextActionsType.SetCodemarkColorFilter:
			return { ...state, codemarkColorFilter: action.payload };
		case ContextActionsType.SetChannelFilter:
			return { ...state, channelFilter: action.payload };
		case ContextActionsType.SetIssueProvider:
			return { ...state, issueProvider: action.payload };
		case PreferencesActionsType.Set:
		case PreferencesActionsType.Update: {
			if (action.payload.showChannels) {
				return { ...state, channelFilter: action.payload.showChannels };
			}
			return state;
		}
		case "RESET":
			return initialState;
		default:
			return { ...initialState, ...state };
	}
}
