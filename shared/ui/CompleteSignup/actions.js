import { setContext } from "../actions/context";

export const validateSignup = () => async (dispatch, getState, { api }) => {
	try {
		const response = await api.validateSignup();
		dispatch({ type: "ADD_STREAMS", payload: response.streams });
		dispatch({ type: "ADD_TEAMS", payload: response.teams });
		dispatch({ type: "ADD_USERS", payload: response.users });
		dispatch(setContext({ currentTeamId: response.currentTeamId }));
		dispatch({ type: "INIT_SESSION", payload: { userId: response.currentUserId } });
	} catch (error) {
		console.error(error);
	}
};
