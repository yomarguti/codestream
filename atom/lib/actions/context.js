export const setContext = data => ({
	type: "SET_CONTEXT",
	payload: data
});
export const setRepoAttributes = data => ({
	type: "SET_REPO_ATTRIBUTES",
	payload: data
});
export const setCurrentTeam = id => ({
	type: "SET_CURRENT_TEAM",
	payload: id
});
export const setCurrentRepo = id => ({
	type: "SET_CURRENT_REPO",
	payload: id
});
export const setCurrentFile = file => ({
	type: "SET_CURRENT_FILE",
	payload: file
});
export const setCurrentCommit = hash => ({
	type: "SET_CURRENT_COMMIT",
	payload: hash
});
export const commitHashChanged = hash => ({
	type: "COMMIT_HASH_CHANGED",
	payload: hash
});
export const logout = () => dispatch => {
	dispatch({ type: "CLEAR_SESSION" });
	dispatch({ type: "RESET_ONBOARDING" });
	dispatch({
		type: "SET_CONTEXT",
		payload: { currentTeamId: undefined, currentRepoId: undefined, usernamesInTeam: [] }
	});
};
