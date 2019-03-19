import { updateCapabilities } from "./capabilities/actions";
import { action } from "./common";
import * as configsActions from "./configs/actions";
import * as connectivityActions from "./connectivity/actions";
import * as contextActions from "./context/actions";
import * as editorContextActions from "./editorContext/actions";
import * as preferencesActions from "./preferences/actions";
import { bootstrapRepos } from "./repos/actions";
import { bootstrapServices } from "./services/actions";
import * as sessionActions from "./session/actions";
import { bootstrapStreams } from "./streams/actions";
import { bootstrapTeams } from "./teams/actions";
import * as unreadsActions from "./unreads/actions";
import { updateUnreads } from "./unreads/actions";
import { bootstrapUsers } from "./users/actions";
import { isSignedInBootstrap, BootstrapResponse } from "../ipc/host.protocol";
import { goToLogin } from "./route/actions";

export enum BootstrapActionType {
	Complete = "@bootstrap/Complete"
}

export const reset = () => action("RESET");

export const bootstrap = (data: BootstrapResponse) => async dispatch => {
	if (isSignedInBootstrap(data)) {
		dispatch(bootstrapUsers(data.users || []));
		dispatch(bootstrapTeams(data.teams || []));
		dispatch(bootstrapStreams(data.streams || []));
		dispatch(bootstrapRepos(data.repos || []));
		// TODO: I think this should be removed and just live with the caps below
		dispatch(bootstrapServices((data.capabilities && data.capabilities.services) || {}));
		dispatch(updateUnreads(data.unreads || {}));
		dispatch(contextActions.setContext({ hasFocus: true, ...data.context }));
		dispatch(editorContextActions.setEditorContext(data.editorContext));
		dispatch(sessionActions.setSession(data.session));
		dispatch(preferencesActions.setPreferences(data.preferences));
	}
	if (data.configs.email) {
		dispatch(goToLogin());
	}
	dispatch(updateCapabilities(data.capabilities || {}));
	dispatch(actions.updateConfigs(data.configs));
	dispatch({ type: "@pluginVersion/Set", payload: data.version });
	dispatch({ type: BootstrapActionType.Complete });
};

export const actions = {
	bootstrap,
	reset,
	...preferencesActions,
	...unreadsActions,
	...connectivityActions,
	...configsActions,
	...contextActions,
	...editorContextActions
};
