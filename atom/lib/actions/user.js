import { upsert } from "../local-cache";
import { normalize } from "./utils";

export const saveUser = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "users", attributes).then(user =>
		dispatch({
			type: "ADD_USER",
			payload: user
		})
	);
};

export const saveUsers = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "users", attributes).then(users =>
		dispatch({
			type: "ADD_USERS",
			payload: users
		})
	);
};

export const fetchCurrentUser = () => (dispatch, getState, { http }) => {
	const { session } = getState();
	return http
		.get("/users/me", session.accessToken)
		.then(data => dispatch(saveUser(normalize(data.user))));
};
