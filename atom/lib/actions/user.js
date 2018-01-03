import { upsert } from "../local-cache";

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
