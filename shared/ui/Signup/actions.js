export { goToLogin } from "../store/route/actions";
export { startSignup } from "../Login/actions";

export const startSlackSignin = () => (dispatch, getState, { api }) => {
	api.startSlackSignin().then(() => {
		dispatch({ type: "GO_TO_COMPLETE_SIGNUP", payload: { authType: "slack" } });
	});
};
