import Raven from "raven-js";

export const resetContext = data => ({ type: "RESET_CONTEXT" });

export const noGit = () => ({ type: "NO_GIT_IN_PATH" });
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
	dispatch({ type: "RESET_UMI" });
	dispatch({ type: "RESET_CONTEXT" });
};
export const noAccess = () => ({ type: "NO_ACCESS" });
export const noRemoteUrl = () => ({ type: "NO_ACCESS-MISSING_REMOTE_URL" });
