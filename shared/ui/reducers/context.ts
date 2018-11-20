import { Type } from "../actions/context";

const initialState = {
	currentFile: "",
	mostRecentSourceFile: "",
	currentTeamId: "",
	currentRepoId: "",
	currentCommit: "",
	currentStreamId: "",
	threadId: null,
	panelStack: ["channels"],
	hasFocus: true // we assume we start with the focus when codestream initializes
};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "RESET_CONTEXT":
			return {
				...initialState,
				currentFile: state.currentFile,
				currentCommit: state.currentCommit
			};
		case "SET_CONTEXT":
			return { ...state, ...payload };
		case "SET_CURRENT_FILE": {
			const file = payload.editor && payload.editor.fileName;
			if (file) return { ...state, currentFile: file, mostRecentSourceFile: file };
			else return { ...state, currentFile: "" };
		}
		case "SET_CURRENT_TEAM":
			return { ...state, currentTeamId: payload };
		case "SET_CURRENT_STREAM":
			return { ...state, currentStreamId: payload, threadId: null };
		case Type.SetThread: {
			return { ...state, currentStreamId: payload.streamId, threadId: payload.threadId };
		}
		case "SET_PANEL":
			return { ...state, panelStack: [payload, ...state.panelStack].slice(0, 10) };
		case "CLOSE_PANEL": {
			if (state.panelStack.length === 1) return state;
			const [, ...panelStack] = state.panelStack;
			return { ...state, panelStack };
		}
		case "COMMIT_HASH_CHANGED":
			return { ...state, currentCommit: payload };
		case "SET_HAS_FOCUS":
			return { ...state, hasFocus: payload };
		default:
			return { ...initialState, ...state };
	}
};
