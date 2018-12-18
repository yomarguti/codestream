import { bootstrap as bootstrapStreams } from "../store/streams/actions";
import { bootstrapUsers } from "../store/users/actions";
import { setCurrentFile } from "../store/context/actions";
import { updateCapabilities } from "../store/capabilities/actions";
import { updatePreferences } from "../store/preferences/actions";
import { updateUnreads } from "../store/unreads/actions";

export * from "../store/connectivity/actions";
export * from "../store/configs/actions";
export { updatePreferences, updateUnreads };

export const reset = () => ({ type: "RESET" });

export const bootstrap = (data = {}) => async dispatch => {
	dispatch(bootstrapUsers(data.users || []));
	dispatch({ type: "BOOTSTRAP_TEAMS", payload: data.teams || [] });
	dispatch(bootstrapStreams(data.streams || []));
	dispatch({ type: "BOOTSTRAP_REPOS", payload: data.repos || [] });
	dispatch({ type: "BOOTSTRAP_SERVICES", payload: data.services || {} });
	dispatch(updateUnreads(data.unreads || {}));
	dispatch(updateCapabilities(data.capabilities || {}));
	dispatch(updatePreferences(data.preferences || {}));
	dispatch({ type: "BOOTSTRAP_COMPLETE" });
};

export const fileChanged = editor => setCurrentFile(editor.fileName, editor.fileStreamId);
