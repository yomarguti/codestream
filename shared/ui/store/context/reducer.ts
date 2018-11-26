import { Action } from "../types";
import { Type } from "./actions";

const initialState = {
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

export function reduceContext(state = initialState, { type, payload }: Action<Type>) {
	switch (type) {
		case Type.ResetContext:
			return {
				...initialState,
				currentFile: state.currentFile,
				currentCommit: state.currentCommit
			};
		case Type.SetContext:
			return { ...state, ...payload };
		case Type.SetCurrentFile: {
			const file = payload.editor && payload.editor.fileName;
			if (file) return { ...state, currentFile: file, mostRecentSourceFile: file };
			else return { ...state, currentFile: "" };
		}
		case Type.SetCurrentTeam:
			return { ...state, currentTeamId: payload };
		case Type.SetCurrentStream:
			return { ...state, currentStreamId: payload, threadId: null };
		case Type.SetThread: {
			return { ...state, currentStreamId: payload.streamId, threadId: payload.threadId };
		}
		case Type.OpenPanel:
			return { ...state, panelStack: [payload, ...state.panelStack].slice(0, 10) };
		case Type.ClosePanel: {
			if (state.panelStack.length === 1) return state;
			const [, ...panelStack] = state.panelStack;
			return { ...state, panelStack };
		}
		case Type.SetFocusState:
			return { ...state, hasFocus: payload };
		case Type.SetCodeMarkFileFilter:
			return { ...state, codemarkFileFilter: payload };
		case Type.SetCodemarkTypeFilter:
			return { ...state, codemarkTypeFilter: payload };
		case Type.SetChannelFilter:
			return { ...state, channelFilter: payload };
		default:
			return { ...initialState, ...state };
	}
}
