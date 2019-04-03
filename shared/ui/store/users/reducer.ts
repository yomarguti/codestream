import { CSUser } from "@codestream/protocols/api";
import { createSelector } from "reselect";
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
			return { ...state, [action.payload.id]: updateUser(action.payload, state) };
		case UsersActionsType.Add: {
			const updatedUsers = action.payload.map(user => updateUser(user, state));
			return { ...state, ...toMapBy("id", updatedUsers) };
		}
		case "RESET":
			return initialState;
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
export const getTeamMembers = createSelector(
	getTeam,
	getUsers,
	(team, users) => {
		return mapFilter(team.memberIds, id => {
			const user = users[id];
			if (user && !user.deactivated) return user;
		});
	}
);

export const getAllUsers = createSelector(
	getUsers,
	(users: State) => Object.values(users)
);
export const getUsernames = createSelector(
	getAllUsers,
	users => {
		return users.map(getUsername);
	}
);

export const getUsernamesById = createSelector(
	getAllUsers,
	users => {
		const map = {};
		users.forEach(user => {
			map[user.id] = getUsername(user);
		});
		return map;
	}
);

export const getNormalizedUsernames = createSelector(
	getUsernames,
	usernames => {
		return mapFilter(usernames, username => username && username.toLowerCase());
	}
);

// this is memoized because it can be expensive for bigger teams
// and only needs to be computed infrequently
export const getUsernamesRegexp = createSelector(
	getTeamMembers,
	members => {
		// this usenames regexp is a pipe-separated list of
		// either usernames or if no username exists for the
		// user then his email address. it is sorted by length
		// so that the longest possible match will be made.
		return members
			.map(user => {
				return user.username || "";
			})
			.sort(function(a, b) {
				return b.length - a.length;
			})
			.join("|")
			.replace(/\|\|+/g, "|") // remove blank identifiers
			.replace(/\+/g, "\\+") // replace + and . with escaped versions so
			.replace(/\./g, "\\."); // that the regexp matches the literal chars
	}
);

export const getUserByCsId = createSelector(
	(state: State) => state,
	(_: any, codestreamId: string) => codestreamId,
	(users: State, codestreamId: string) => {
		for (let user of Object.values(users)) {
			if (user.codestreamId === codestreamId || user.id === codestreamId) return user;
		}
		return undefined;
	}
);
