import { updateCapabilities } from "../store/capabilities/actions";
import { action } from "../store/common";
import { setCurrentFile } from "../store/context/actions";
import { updatePreferences } from "../store/preferences/actions";
import { bootstrapRepos } from "../store/repos/actions";
import { bootstrapServices } from "../store/services/actions";
import { bootstrapStreams } from "../store/streams/actions";
import { bootstrapTeams } from "../store/teams/actions";
import { updateUnreads } from "../store/unreads/actions";
import { bootstrapUsers } from "../store/users/actions";

export * from "../store/connectivity/actions";
export * from "../store/configs/actions";
export { updatePreferences, updateUnreads };

export const reset = () => action("RESET");

export const bootstrap = (data: { [k: string]: any } = {}) => async dispatch => {
	dispatch(bootstrapUsers(data.users || []));
	dispatch(bootstrapTeams(data.teams || []));
	dispatch(bootstrapStreams(data.streams || []));
	dispatch(bootstrapRepos(data.repos || []));
	dispatch(bootstrapServices(data.services || {}));
	dispatch(updateUnreads(data.unreads || {}));
	dispatch(updateCapabilities(data.capabilities || {}));
	dispatch(updatePreferences(data.preferences || {}));
	dispatch({ type: "BOOTSTRAP_COMPLETE" });
};

export const fileChanged = editor => setCurrentFile(editor.fileName, editor.fileStreamId);
