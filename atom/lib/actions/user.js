import db from "../local-cache";

export const saveUser = user => dispatch => {
	return db.users.put(user).then(() =>
		dispatch({
			type: "ADD_USER",
			payload: user
		})
	);
};
