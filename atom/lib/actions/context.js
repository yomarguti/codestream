import Raven from "raven-js";
import { setPresence } from "./presence.js";

export const resetContext = data => ({ type: "RESET_CONTEXT" });

export const noGit = () => ({ type: "NO_GIT_IN_PATH" });
export const setContext = data => ({
	type: "SET_CONTEXT",
	payload: data
});

// TODO: move these into their own collection of repoAttribute actions
export const setRepoAttributes = data => ({
	type: "SET_REPO_ATTRIBUTES",
	payload: data
});
export const setRepoUrl = url => ({ type: "SET_REPO_URL", payload: url });

export const noGit = () => ({ type: "NO_GIT_IN_PATH" });
export const showSlackInfo = () => ({ type: "SHOW_SLACK_INFO" });
export const cancelSlackInfo = () => ({ type: "CANCEL_SLACK_INFO" });
export const resetContext = data => ({ type: "RESET_CONTEXT" });
export const setContext = data => ({
	type: "SET_CONTEXT",
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
	dispatch(setPresence("offline"));
	dispatch({ type: "CLEAR_SESSION" });
	dispatch({ type: "RESET_ONBOARDING" });
	dispatch({ type: "RESET_UMI" });
	dispatch({ type: "RESET_CONTEXT" });
};
export const noAccess = () => ({ type: "NO_ACCESS" });
export const noRemoteUrl = () => ({ type: "NO_ACCESS-MISSING_REMOTE_URL" });
