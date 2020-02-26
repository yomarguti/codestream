import { CSUser } from "@codestream/protocols/api";
import { action } from "../common";
import { UsersActionsType } from "./types";
import {
	GetRepoScmStatusesRequestType,
	SetModifiedReposRequestType
} from "@codestream/protocols/agent";
import { CodeStreamState } from "../../store";
import { HostApi } from "../../webview-api";

export const reset = () => action("RESET");

export const bootstrapUsers = (users: CSUser[]) => action(UsersActionsType.Bootstrap, users);

export const updateUser = (user: CSUser) => action(UsersActionsType.Update, user);

export const addUsers = (users: CSUser[]) => action(UsersActionsType.Add, users);

export const updateModifiedRepos = () => async (dispatch, getState: () => CodeStreamState) => {
	const { users, session, context, apiVersioning } = getState();

	// this neuters
	if (!apiVersioning.apiCapabilities.xray) return;

	const userId = session.userId;
	if (!userId) return;
	const currentUser = users[userId];
	if (!currentUser) return;

	const invisible = currentUser.status ? currentUser.status.invisible : false;
	if (invisible) {
		dispatch(clearModifiedFiles());
		return;
	}

	const result = await HostApi.instance.send(GetRepoScmStatusesRequestType, {});
	if (!result.scm) return;

	let modifiedRepos = currentUser.modifiedRepos || {};

	// this is a fix for legacy modifiedRepos data that used to be
	// an array rather than a hash based on team Id
	if (Array.isArray(modifiedRepos)) modifiedRepos = {};

	modifiedRepos[context.currentTeamId] = result.scm;
	dispatch(_updateModifiedRepos(modifiedRepos));
};

export const clearModifiedFiles = () => _updateModifiedRepos({});

const _updateModifiedRepos = (modifiedRepos: { [teamId: string]: any[] }) => async (
	dispatch,
	getState: () => CodeStreamState
) => {
	const response = await HostApi.instance.send(SetModifiedReposRequestType, {
		modifiedRepos
	});
	if (response && response.user) {
		dispatch(updateUser(response.user));
	}
};
