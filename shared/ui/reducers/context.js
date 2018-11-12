const initialState = {
	currentFile: "",
	mostRecentSourceFile: "",
	currentTeamId: "",
	currentRepoId: "",
	currentCommit: "",
	panelStack: ["channels"], // stores the stack of panels
	hasFocus: true // we assume we start with the focus when codestream initializes
};

export default (state = initialState, { type, payload }) => {
	if (type === "RESET_CONTEXT")
		return { ...initialState, currentFile: state.currentFile, currentCommit: state.currentCommit };
	if (type === "SET_CONTEXT") return { ...state, ...payload };
	if (type === "SET_CURRENT_FILE") {
		const file = payload.editor && payload.editor.fileName;
		if (file) return { ...state, currentFile: file, mostRecentSourceFile: file };
		else return { ...state, currentFile: "" };
	}
	if (type === "SET_CURRENT_TEAM") return { ...state, currentTeamId: payload };
	if (type === "SET_CURRENT_STREAM") return { ...state, currentStreamId: payload };
	if (type === "SET_PANEL") {
		// set the current panel and keep a stack of the most
		// recent ones, so we can pop the current panel off the
		// stack, and return to the prior one
		return { ...state, panelStack: [payload, ...state.panelStack].slice(0, 10) };
	}
	if (type === "CLOSE_PANEL") {
		if (state.panelStack.length === 1) return state;
		const [, ...panelStack] = state.panelStack;
		return { ...state, panelStack };
	}
	if (type === "COMMIT_HASH_CHANGED") return { ...state, currentCommit: payload };
	if (type === "SET_HAS_FOCUS") return { ...state, hasFocus: payload };
	return { ...initialState, ...state };
};
