import { goToCompleteSignup } from "../store/route/actions";

export { goToLogin } from "../store/route/actions";
export { startSignup } from "../Login/actions";

export const startSlackSignin = () => (dispatch, getState, { api }) => {
	api.startSlackSignin().then(() => {
		dispatch(goToCompleteSignup({ authType: "slack" }));
	});
};

export const connectSlack = () => (dispatch, getState, { api }) => {
	return api.startSlackSignin().then(() => {
		dispatch({ type: "GO_TO_COMPLETE_CONNECT", payload: { authType: "slack" } });
	});
};

export const connectService = service => (dispatch, getState, { api }) => {
	api.connectService(service).then(() => {
		dispatch({ type: "GO_TO_COMPLETE_CONNECT", payload: { authType: service } });
	});
};
