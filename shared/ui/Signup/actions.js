import { goToCompleteSignup } from "../store/route/actions";

export { goToLogin } from "../store/route/actions";
export { startSignup } from "../Login/actions";

export const startSlackSignin = () => (dispatch, getState, { api }) => {
	api.startSlackSignin().then(() => {
		dispatch(goToCompleteSignup({ authType: "slack" }));
	});
};
