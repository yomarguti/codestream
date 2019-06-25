import { updateCapabilities } from "./capabilities/actions";
import { action } from "./common";
import * as contextActions from "./context/actions";
import * as editorContextActions from "./editorContext/actions";
import * as preferencesActions from "./preferences/actions";
import { bootstrapRepos } from "./repos/actions";
import { bootstrapServices } from "./services/actions";
import * as sessionActions from "./session/actions";
import { bootstrapStreams } from "./streams/actions";
import { bootstrapTeams } from "./teams/actions";
import { updateUnreads } from "./unreads/actions";
import { updateProviders } from "./providers/actions";
import { bootstrapUsers } from "./users/actions";
import {
	isSignedInBootstrap,
	BootstrapRequestType,
	BootstrapResponse,
	LoginSSORequestType,
	ValidateThirdPartyAuthRequestType,
	LogoutRequestType
} from "../ipc/host.protocol";
import { HostApi } from "../webview-api";
import { logError } from "../logger";
import { LoginResult } from "@codestream/protocols/api";
import { updateConfigs } from "./configs/actions";
import { emptyObject } from "../utils";
import { ChatProviderAccess } from "./context/types";
import { CodeStreamState } from ".";
import { localStore } from "../utilities/storage";

export enum BootstrapActionType {
	Complete = "@bootstrap/Complete"
}

export const reset = () => action("RESET");

export const bootstrap = (bootstrapData?: BootstrapResponse) => async dispatch => {
	const data = bootstrapData || (await HostApi.instance.send(BootstrapRequestType, {}));

	if (isSignedInBootstrap(data)) {
		dispatch(bootstrapUsers(data.users || []));
		dispatch(bootstrapTeams(data.teams || []));
		dispatch(bootstrapStreams(data.streams || []));
		dispatch(bootstrapRepos(data.repos || []));
		// TODO: I think this should be removed and just live with the caps below
		dispatch(bootstrapServices((data.capabilities && data.capabilities.services) || {}));
		dispatch(updateUnreads(data.unreads || {}));
		dispatch(updateProviders(data.providers || {}));
		dispatch(editorContextActions.setEditorContext(data.editorContext));
		dispatch(sessionActions.setSession(data.session));
		dispatch(preferencesActions.setPreferences(data.preferences));
	}
	dispatch(contextActions.setContext({ hasFocus: true, ...data.context }));
	dispatch(updateCapabilities(data.capabilities || {}));
	dispatch(updateConfigs(data.configs));
	dispatch({ type: "@pluginVersion/Set", payload: data.version });
	dispatch({ type: BootstrapActionType.Complete });
};

export const startSSOSignin = (
	provider: string,
	info?: ValidateSignupInfo,
	access?: ChatProviderAccess
) => async (dispatch, getState) => {
	if (access == undefined) {
		access = (getState() as CodeStreamState).context.chatProviderAccess;
	}
	try {
		await HostApi.instance.send(LoginSSORequestType, {
			provider: provider,
			queryString: access === "strict" ? "access=strict" : undefined
		});
		return dispatch(
			contextActions.goToSSOAuth(provider, { ...(info || emptyObject), mode: access })
		);
	} catch (error) {
		logError(`Unable to start ${provider} sign in: ${error}`);
	}
};

export const reAuthForFullChatProvider = (
	provider: string,
	info?: ValidateSignupInfo
) => async dispatch => {
	await HostApi.instance.send(LogoutRequestType, {});
	dispatch(reset());

	dispatch(startSSOSignin(provider, info, "permissive"));
};

export enum SignupType {
	JoinTeam = "joinTeam",
	CreateTeam = "createTeam"
}

export interface ValidateSignupInfo {
	type: SignupType;
}

export const validateSignup = (provider: string, signupInfo?: ValidateSignupInfo) => async (
	dispatch,
	getState
) => {
	try {
		const response = await HostApi.instance.send(ValidateThirdPartyAuthRequestType, {
			alias: signupInfo !== undefined
		});
		if (signupInfo) {
			HostApi.instance.track("Signup Completed", {
				"Signup Type": signupInfo.type === SignupType.CreateTeam ? "Organic" : "Viral"
			});
		} else {
			HostApi.instance.track("Signed In", { "Auth Type": provider });
			if (localStore.get("enablingRealTime") === true) {
				localStore.delete("enablingRealTime");
				HostApi.instance.track("Slack Chat Enabled");
				const result = await dispatch(bootstrap(response));
				dispatch(contextActions.setContext({ chatProviderAccess: "permissive" }));
				return result;
			}
		}

		return await dispatch(bootstrap(response));
	} catch (error) {
		if (error === LoginResult.ProviderConnectFailed) {
			throw error;
		}
		if (error === LoginResult.ExpiredToken) {
			throw error;
		}
	}
};
