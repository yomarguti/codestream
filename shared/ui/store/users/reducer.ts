import { CSUser, CSStream, StreamType } from "@codestream/protocols/api";
import { createSelector } from "reselect";
import { mapFilter, toMapBy, emptyArray } from "../../utils";
import { ActionType } from "../common";
import * as actions from "./actions";
import { UsersState, UsersActionsType } from "./types";
import { CodeStreamState } from "..";
import { difference, isString } from "lodash-es";
import { getStreamForId } from "../streams/reducer";

type UsersActions = ActionType<typeof actions>;

const initialState: UsersState = {};

const updateUser = (payload: CSUser, users: UsersState) => {
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

const getCurrentTeam = (state: CodeStreamState) => state.teams[state.context.currentTeamId];

export const getTeamMembers = createSelector(getCurrentTeam, getUsers, (team, users) => {
	const memberIds = difference(team.memberIds, team.removedMemberIds || []);
	return mapFilter(memberIds, (id: string) => {
		const user: CSUser = users[id];
		return user && !user.deactivated && !user.externalUserId ? user : undefined;
	}).sort((a, b) => a.username.localeCompare(b.username));
});

export const getTeamMates = createSelector(
	getTeamMembers,
	(state: CodeStreamState) => state.session.userId!,
	(members: CSUser[], userId: string) => members.filter(m => m.id !== userId && m.isRegistered)
);

// return the team tags as an array, in sort order
export const getTeamTagsArray = createSelector(getCurrentTeam, team => {
	if (team.tags == null) {
		return emptyArray;
	}

	return mapFilter(Object.entries(team.tags), ([id, tag]) =>
		tag.deactivated ? null : { id, ...tag }
	).sort((a, b) => (a.sortOrder == null || b.sortOrder == null ? -1 : a.sortOrder - b.sortOrder));
});

// return the team tags as an associative array (hash)
export const getTeamTagsHash = createSelector(getTeamTagsArray, tagsArray => {
	return toMapBy("id", tagsArray);
});

export const getAllUsers = createSelector(getUsers, (users: UsersState) => Object.values(users));
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

export const getUsernamesByIdLowerCase = createSelector(getAllUsers, users => {
	const map: { [id: string]: string } = {};
	users.forEach(user => {
		map[user.id] = getUsername(user).toLowerCase();
	});
	return map;
});

export const getNormalizedUsernames = createSelector(getUsernames, usernames => {
	return mapFilter(usernames, username => username && username.toLowerCase());
});

export const getUserByCsId = createSelector(
	(state: UsersState) => state,
	(_: any, codestreamId: string) => codestreamId,
	(users: UsersState, codestreamId: string) => {
		for (let user of Object.values(users)) {
			if (user.codestreamId === codestreamId || user.id === codestreamId) return user;
		}
		return undefined;
	}
);

export const findMentionedUserIds = (members: CSUser[], text: string) => {
	const mentionedUserIds: string[] = [];
	if (text == null || text.length === 0) {
		return mentionedUserIds;
	}

	members.forEach(user => {
		const matcher = user.username.replace(/\+/g, "\\+").replace(/\./g, "\\.");
		if (text.match("@" + matcher + "\\b")) {
			mentionedUserIds.push(user.id);
		}
	});
	return mentionedUserIds;
};

export const getStreamMembers = createSelector(
	state => state.users,
	(state: CodeStreamState, streamOrId: CSStream | string) => {
		return isString(streamOrId)
			? getStreamForId(state.streams, state.context.currentTeamId, streamOrId)
			: streamOrId;
	},
	(users: UsersState, stream?: CSStream) => {
		if (stream == undefined || stream.type === StreamType.File || stream.memberIds == undefined)
			return [];

		return mapFilter(stream.memberIds, id => {
			const user = users[id];
			if (user && user.isRegistered) return user;
			return;
		});
	}
);
