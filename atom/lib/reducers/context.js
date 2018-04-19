const initialState = {
	currentFile: "",
	currentTeamId: "",
	currentRepoId: "",
	currentCommit: "",
	noAccess: false,
	showSlackInfo: false,
	usernamesInTeam: []
};

export default (state = initialState, { type, payload }) => {
	if (type === "RESET_CONTEXT")
		return { ...initialState, currentFile: state.currentFile, currentCommit: state.currentCommit };
	if (type === "SET_CONTEXT") return { ...state, ...payload };
	if (type === "SET_CURRENT_FILE") return { ...state, currentFile: payload };
	if (type === "SET_CURRENT_TEAM") return { ...state, currentTeamId: payload };
	if (type === "SET_CURRENT_REPO") return { ...state, currentRepoId: payload };
	if (type === "SET_CURRENT_COMMIT") return { ...state, currentCommit: payload };
	if (type === "COMMIT_HASH_CHANGED") return { ...state, currentCommit: payload };
	if (type === "SET_HAS_FOCUS") return { ...state, hasFocus: payload };
	if (type === "NO_ACCESS") return { ...state, noAccess: { noAccess: true } };
	if (type === "NO_ACCESS-MISSING_REMOTE_URL") return { ...state, noAccess: { noUrl: true } };
	if (type === "NO_GIT_IN_PATH") return { ...state, noAccess: { noGit: true } };
	if (type === "SHOW_SLACK_INFO") return { ...state, showSlackInfo: true };
	if (type === "CANCEL_SLACK_INFO") return { ...state, showSlackInfo: false };
	return state;
};
