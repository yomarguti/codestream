import { updateCapabilities } from "./capabilities/actions";
import { action } from "./common";
import * as configsActions from "./configs/actions";
import * as connectivityActions from "./connectivity/actions";
import * as contextActions from "./context/actions";
import { updatePreferences } from "./preferences/actions";
import * as preferencesActions from "./preferences/actions";
import { bootstrapRepos } from "./repos/actions";
import { bootstrapServices } from "./services/actions";
import { bootstrapStreams } from "./streams/actions";
import { bootstrapTeams } from "./teams/actions";
import * as unreadsActions from "./unreads/actions";
import { updateUnreads } from "./unreads/actions";
import { bootstrapUsers } from "./users/actions";

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

export const actions = {
	bootstrap,
	reset,
	...preferencesActions,
	...unreadsActions,
	...connectivityActions,
	...configsActions,
	...contextActions
};
