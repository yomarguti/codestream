import { setContext } from "../actions/context";

const errorMappings = {
	INVALID_CREDENTIALS: { invalidCredentials: true }
};

export const authenticate = params => async (dispatch, getState, { api }) => {
	try {
		const response = await api.authenticate(params);
		dispatch({ type: "ADD_STREAMS", payload: response.streams });
		dispatch({ type: "ADD_TEAMS", payload: response.teams });
		dispatch({ type: "ADD_USERS", payload: response.users });
		dispatch(setContext({ currentTeamId: response.currentTeamId }));
		dispatch({ type: "INIT_SESSION", payload: { userId: response.currentUserId } });
	} catch (error) {
		throw errorMappings[error];
	}
};
