import { toMapBy } from "./utils";

const initialState = {};

const updateUser = (payload, users) => {
	const user = users[payload.id] || {};
	return { ...user, ...payload };
};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "BOOTSTRAP_USERS":
			return toMapBy("id", payload);
		case "USERS-UPDATE_FROM_PUBNUB":
		case "UPDATE_USER":
		case "ADD_USER":
			return { ...state, [payload.id]: updateUser(payload, state) };
		case "ADD_USERS": {
			const updatedUsers = payload.map(user => updateUser(user, state));
			return { ...state, ...toMapBy("id", updatedUsers) };
		}
		default:
			return state;
	}
};

export function getUsernames(state) {
	return Object.values(state).map(user => {
		if (!user.username && user.email) {
			return user.email.replace(/@.*/, "");
		}
		return user.username;
	});
}
