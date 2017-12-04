const initialState = {
	currentFile: "",
	currentTeamId: "",
	currentRepoId: "",
	usernamesInTeam: []
};

export default (state = initialState, { type, payload }) => {
	if (type === "SET_CONTEXT") return { ...state, ...payload };
	if (type === "SET_CURRENT_FILE") return { ...state, currentFile: payload };
	if (type === "SET_CURRENT_TEAM") return { ...state, currentTeamId: payload };
	if (type === "SET_CURRENT_REPO") return { ...state, currentRepoId: payload };
	return state;
};
