import { bootstrap } from "../store/actions";
import { setContext } from "../store/context/actions";
export { startSignup } from "../Login/actions";
export { goToLogin } from "../store/route/actions";
import { updateUnreads } from "../store/unreads/actions";

export const validateSignup = token => async (dispatch, getState, { api }) => {
	const response = await api.validateSignup(token);
	await dispatch(bootstrap(response));
	dispatch(setContext({ currentTeamId: response.currentTeamId }));
	dispatch(updateUnreads(response.unreads));
	dispatch({ type: "INIT_SESSION", payload: { userId: response.currentUserId } });
};
