import { bootstrap } from "../actions";
import { setContext } from "../actions/context";

export const authenticate = params => async (dispatch, getState, { api }) => {
	const response = await api.authenticate(params);
	dispatch(bootstrap(response));
	dispatch(setContext({ currentTeamId: response.currentTeamId }));
	dispatch({ type: "INIT_SESSION", payload: { userId: response.currentUserId } });
	dispatch({ type: "UPDATE_UNREADS", payload: response.unreads });
};

export const startSignup = () => async (dispatch, getState, { api }) => {
	try {
		await api.startSignup();
		dispatch({ type: "GO_TO_COMPLETE_SIGNUP" });
	} catch (error) {
		console.error(error);
	}
};
