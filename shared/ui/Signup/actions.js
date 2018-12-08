import { goToCompleteSignup } from "../store/route/actions";

export { goToLogin } from "../store/route/actions";
export { startSignup } from "../Login/actions";

export const startSlackSignin = () => (dispatch, getState, { api }) => {
	api.startSlackSignin().then(() => {
		dispatch(goToCompleteSignup({ authType: "slack" }));
	});
};

export const connectSlack = () => (dispatch, getState, { api }) => {
	api.startSlackSignin().then(() => {
		dispatch({ type: "GO_TO_COMPLETE_CONNECT", payload: { authType: "slack" } });
	});
};

export const connectTrello = () => (dispatch, getState, { api }) => {
	api.startTrelloSignin().then(() => {
		dispatch({ type: "GO_TO_COMPLETE_CONNECT", payload: { authType: "trello" } });
	});
};

export const connectJira = () => (dispatch, getState, { api }) => {
	api.startJiraSignin().then(() => {
		dispatch({ type: "GO_TO_COMPLETE_CONNECT", payload: { authType: "jira" } });
	});
};

export const connectGitHub = () => (dispatch, getState, { api }) => {
	api.startGitHubSignin().then(() => {
		dispatch({ type: "GO_TO_COMPLETE_CONNECT", payload: { authType: "github" } });
	});
};

export const connectAsana = () => (dispatch, getState, { api }) => {
	api.startAsanaSignin().then(() => {
		dispatch({ type: "GO_TO_COMPLETE_CONNECT", payload: { authType: "asana" } });
	});
};
