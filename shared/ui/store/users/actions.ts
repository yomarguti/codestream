import { CSUser } from "@codestream/protocols/api";
import { action } from "../common";
import { UsersActionsType } from "./types";
import { GetRepoScmStatusesRequestType, SetModifiedReposRequestType } from '@codestream/protocols/agent';
import { CodeStreamState } from "../../store";
import { HostApi } from '../../webview-api';

export const reset = () => action("RESET");

export const bootstrapUsers = (users: CSUser[]) => action(UsersActionsType.Bootstrap, users);

export const updateUser = (user: CSUser) => action(UsersActionsType.Update, user);

export const addUsers = (users: CSUser[]) => action(UsersActionsType.Add, users);

export const updateModifiedFiles = () => async (dispatch, getState: () => CodeStreamState) => {
	const { users, session } = getState();
	const userId = session.userId;
	if (userId) {
		const currentUser = users[userId];
		const invisible = currentUser.status ? currentUser.status.invisible : false;
		if (invisible) {
			dispatch(clearModifiedFiles());
			return;
		}
	}
	const result = await HostApi.instance.send(GetRepoScmStatusesRequestType, {});
	if (!result.scm) return;

	dispatch(_updateModifiedFiles(result.scm));
}

export const clearModifiedFiles = () => _updateModifiedFiles([]);

const _updateModifiedFiles = (modifiedFiles: any[]) => async (dispatch, getState: () => CodeStreamState) => {
	const response = await HostApi.instance.send(SetModifiedReposRequestType, { modifiedRepos: modifiedFiles });
	if (response && response.user) {
		dispatch(updateUser(response.user));
	}
}
