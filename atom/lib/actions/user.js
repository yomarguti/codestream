import db from "../local-cache";

export const saveUser = user => dispatch => {
	return db.users.put(user).then(() =>
		dispatch({
			type: "ADD_USER",
			payload: user
		})
	);
};

export const saveUsers = users => dispatch => {
	return db.users.bulkPut(users).then(() =>
		dispatch({
			type: "ADD_USERS",
			payload: users
		})
	);
};
