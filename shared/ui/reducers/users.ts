import { createSelector } from "reselect";
import { mapFilter, toMapBy } from "../utils";

interface UserEntity {
	id: string;
	email: string;
	username?: string;
}

interface UserState {
	[id: string]: UserEntity;
}

const initialState: UserState = {};

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

const getUsers = state => state.users;
const getTeam = state => state.teams[state.context.currentTeamId];
export const getTeamMembers = createSelector(getTeam, getUsers, (team, users) => {
	return mapFilter(team.memberIds, id => {
		const user = users[id];
		if (user && !user.deactivated) return user;
	});
});

export const getAllUsers = createSelector(getUsers, (users: UserState) => Object.values(users));
export const getUsernames = createSelector(getAllUsers, users => {
	return users.map(user => {
		if (!user.username && user.email) {
			return user.email.replace(/@.*/, "");
		}
		return user.username;
	});
});
