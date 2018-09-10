import { bootstrap } from "../actions";
import { setContext } from "../actions/context";
export { startSignup } from "../Login/actions";
export { goToLogin } from "../actions/routing";

export const validateSignup = () => async (dispatch, getState, { api }) => {
	const response = await api.validateSignup();
	dispatch(bootstrap(response));
	dispatch(setContext({ currentTeamId: response.currentTeamId }));
	dispatch({ type: "UPDATE_UNREADS", payload: response.unreads });
	dispatch({ type: "INIT_SESSION", payload: { userId: response.currentUserId } });
};
