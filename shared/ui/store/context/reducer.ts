import { ActionType } from "../common";
import * as preferencesActions from "../preferences/actions";
import * as sessionActions from "../session/actions";
import { PreferencesActionsType } from "../preferences/types";
import * as actions from "./actions";
import { ContextActionsType, ContextState, Route } from "./types";
import { WebviewPanels } from "@codestream/protocols/webview";
import { SessionActionType } from "../session/types";

type ContextActions = ActionType<typeof actions>;
type PreferencesActions = ActionType<typeof preferencesActions>;
type SessionActions = ActionType<typeof sessionActions>;

const initialState: ContextState = {
	chatProviderAccess: "strict",
	newPostEntryPoint: undefined,
	currentTeamId: "",
	currentStreamId: "",
	currentDocumentMarkerId: "",
	currentCodemarkId: undefined,
	issueProvider: undefined,
	threadId: undefined,
	panelStack: [WebviewPanels.CodemarksForFile], // default view is the "in this file" view
	hasFocus: true, // we assume we start with the focus when codestream initializes
	channelFilter: "all",
	channelsMuteAll: false,
	codemarkFileFilter: "all",
	codemarkTypeFilter: "all",
	codemarkTagFilter: "all",
	codemarksFileViewStyle: "inline",
	codemarksShowArchived: false,
	codemarksShowResolved: false,
	showFeedbackSmiley: true,
	route: { name: Route.NewUser, params: {} }
};

export function reduceContext(
	state: ContextState = initialState,
	action: ContextActions | PreferencesActions | SessionActions
) {
	switch (action.type) {
		case ContextActionsType.SetContext:
			return { ...state, ...action.payload };
		case ContextActionsType.SetCurrentStream: {
			const { streamId, threadId } = action.payload;
			return { ...state, currentStreamId: streamId, threadId };
		}
		case ContextActionsType.SetCurrentDocumentMarker:
			return { ...state, currentDocumentMarkerId: action.payload };
		case ContextActionsType.SetCurrentCodemark:
			return { ...state, currentCodemarkId: action.payload };

		case ContextActionsType.OpenPanel:
			return { ...state, panelStack: [action.payload, ...state.panelStack].slice(0, 10) };
		case ContextActionsType.ClosePanel: {
			if (state.panelStack.length === 1) return state;
			const [, ...panelStack] = state.panelStack;
			return { ...state, panelStack };
		}
		case ContextActionsType.SetFocusState:
			return { ...state, hasFocus: action.payload };

		case ContextActionsType.SetChannelsMuteAll:
			return { ...state, channelsMuteAll: action.payload };
		case ContextActionsType.SetChannelFilter:
			return { ...state, channelFilter: action.payload };

		case ContextActionsType.SetCodemarkTagFilter:
			return { ...state, codemarkTagFilter: action.payload };
		case ContextActionsType.SetCodemarkFileFilter:
			return { ...state, codemarkFileFilter: action.payload };
		case ContextActionsType.SetCodemarkTypeFilter:
			return { ...state, codemarkTypeFilter: action.payload };
		case ContextActionsType.SetCodemarksFileViewStyle:
			return { ...state, codemarksFileViewStyle: action.payload };
		case ContextActionsType.SetCodemarksShowArchived:
			return { ...state, codemarksShowArchived: action.payload };
		case ContextActionsType.SetCodemarksShowResolved:
			return { ...state, codemarksShowResolved: action.payload };

		case ContextActionsType.SetShowFeedbackSmiley:
			return { ...state, showFeedbackSmiley: action.payload };

		case ContextActionsType.SetIssueProvider:
			return { ...state, issueProvider: action.payload };

		case ContextActionsType.SetNewPostEntryPoint:
			return { ...state, newPostEntryPoint: action.payload };

		case PreferencesActionsType.Set:
		case PreferencesActionsType.Update: {
			if (action.payload.showChannels) {
				return { ...state, channelFilter: action.payload.showChannels };
			}
			return state;
		}

		case ContextActionsType.SetRoute: {
			return { ...state, route: action.payload };
		}

		case SessionActionType.Set: {
			// started a real session so next time the starting route should be login
			if (action.payload.userId) {
				return { ...state, route: { name: Route.Login, params: {} } };
			}
			return state;
		}

		case "RESET":
			return {
				...initialState,
				route: { name: Route.Login, params: {} },
				chatProviderAccess: state.chatProviderAccess
			};
		default:
			return { ...initialState, ...state };
	}
}
