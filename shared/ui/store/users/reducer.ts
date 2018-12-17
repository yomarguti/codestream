import { createSelector } from "reselect";
import { CSUser } from "../../shared/api.protocol";
import { mapFilter, toMapBy } from "../../utils";
import { ActionType } from "../common";
import * as actions from "./actions";
import { State, UsersActionsType } from "./types";

type UsersActions = ActionType<typeof actions>;

const initialState: State = {};

const updateUser = (payload: CSUser, users: State) => {
	const user = users[payload.id] || {};
	return { ...user, ...payload };
};

export function reduceUsers(state = initialState, action: UsersActions) {
	switch (action.type) {
		case UsersActionsType.Bootstrap: {
			return toMapBy("id", action.payload);
		}
		case UsersActionsType.Update:
		case UsersActionsType.Add:
			return { ...state, [action.payload.id]: updateUser(action.payload, state) };
		case UsersActionsType.AddMultiple: {
			const updatedUsers = action.payload.map(user => updateUser(user, state));
			return { ...state, ...toMapBy("id", updatedUsers) };
		}
		default:
			return state;
	}
}

const getUsername = (user: CSUser) => {
	if (!user.username && user.email) {
		return user.email.replace(/@.*/, "");
	}
	return user.username;
};

const getUsers = state => state.users;
const getTeam = state => state.teams[state.context.currentTeamId];
export const getTeamMembers = createSelector(getTeam, getUsers, (team, users) => {
	return mapFilter(team.memberIds, id => {
		const user = users[id];
		if (user && !user.deactivated) return user;
	});
});

export const getAllUsers = createSelector(getUsers, (users: State) => Object.values(users));
export const getUsernames = createSelector(getAllUsers, users => {
	return users.map(getUsername);
});

export const getUsernamesById = createSelector(getAllUsers, users => {
	const map = {};
	users.forEach(user => {
		map[user.id] = getUsername(user);
	});
	return map;
});

export const getNormalizedUsernames = createSelector(getUsernames, usernames => {
	return mapFilter(usernames, username => username && username.toLowerCase());
});
