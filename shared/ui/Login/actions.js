import { bootstrap } from "../actions";
import { setContext } from "../actions/context";

const errorMappings = {
	INVALID_CREDENTIALS: { invalidCredentials: true }
};

export const authenticate = params => async (dispatch, getState, { api }) => {
	try {
		const response = await api.authenticate(params);
		dispatch(bootstrap(response));
		dispatch(setContext({ currentTeamId: response.currentTeamId }));
		dispatch({ type: "INIT_SESSION", payload: { userId: response.currentUserId } });
		dispatch({ type: "UPDATE_UNREADS", payload: response.unreads });
	} catch (error) {
		throw errorMappings[error];
	}
};

export const startSignup = () => async (dispatch, getState, { api }) => {
	try {
		await api.startSignup();
		dispatch({ type: "GO_TO_COMPLETE_SIGNUP" });
	} catch (error) {
		console.error(error);
	}
};
