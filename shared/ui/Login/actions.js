import { bootstrap } from "../store/actions";
import { setContext } from "../store/context/actions";
import { goToCompleteSignup } from "../store/route/actions";

export { startSlackSignin } from "../Signup/actions";
export { validateSignup } from "../CompleteSignup/actions";
export { goToSignup } from "../store/route/actions";
export { updateUnreads } from "../store/unreads/actions";

export const authenticate = params => async (dispatch, getState, { api }) => {
	const response = await api.authenticate(params);
	dispatch(bootstrap(response));
	dispatch(setContext({ currentTeamId: response.currentTeamId }));
	dispatch({ type: "INIT_SESSION", payload: { userId: response.currentUserId } });
	dispatch(updateUnreads(response.unreads));
};

export const startSignup = () => async (dispatch, getState, { api }) => {
	try {
		await api.startSignup();
		dispatch(goToCompleteSignup());
	} catch (error) {
		console.error(error);
	}
};
