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

export const recalculateUMI = () => async (dispatch, getState, { http }) => {
	const { session, users } = getState();
	const currentUser = users[session.userId];
	dispatch({
		type: "RECALCULATE_UMI",
		payload: currentUser
	});
};

export const incrementUMI = post => async (dispatch, getState, { http }) => {
	const { session, users } = getState();
	const currentUser = users[session.userId];

	var re = new RegExp("@" + currentUser.username + "\\b");
	var hasMention = post.text.match("@" + currentUser.username + "\\b");
	console.log("HAS MENTION IS: ", hasMention);
	console.log("Looking for: ", currentUser.username);
	let type = hasMention ? "INCREMENT_MENTION" : "INCREMENT_UMI";
	console.log("TYPE IS: ", type, post);
	dispatch({
		type: type,
		payload: post.streamId
	});
};

// this is in actions/stream.js
// export const clearUMI = streamId => ({});
