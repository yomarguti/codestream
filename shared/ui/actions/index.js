import { bootstrapStreams } from "../store/streams/actions";
import { bootstrapUsers } from "../store/users/actions";
import { bootstrapServices } from "../store/services/actions";
import { bootstrapRepos } from "../store/repos/actions";
import { bootstrapTeams } from "../store/teams/actions";
import { setCurrentFile } from "../store/context/actions";
import { updateCapabilities } from "../store/capabilities/actions";
import { updatePreferences } from "../store/preferences/actions";
import { updateUnreads } from "../store/unreads/actions";
import { action } from "../store/common";

export * from "../store/connectivity/actions";
export * from "../store/configs/actions";
export { updatePreferences, updateUnreads };

export const reset = () => action("RESET");

export const bootstrap = (data = {}) => async dispatch => {
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
