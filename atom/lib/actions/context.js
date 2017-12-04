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
