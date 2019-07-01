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
	LoginSSORequestType,
	LogoutRequestType,
	SignedInBootstrapData,
	BootstrapInHostResponse
} from "../ipc/host.protocol";
import { HostApi } from "../webview-api";
import { logError } from "../logger";
import { LoginResult } from "@codestream/protocols/api";
import { updateConfigs } from "./configs/actions";
import { emptyObject } from "../utils";
import { ChatProviderAccess } from "./context/types";
import { CodeStreamState } from ".";
import { localStore } from "../utilities/storage";
import {
	OtcLoginRequestType,
	isLoginFailResponse,
	BootstrapRequestType
} from "@codestream/protocols/agent";
import {
	BootstrapInHostRequestType,
	GetActiveEditorContextRequestType
} from "@codestream/protocols/webview";

export enum BootstrapActionType {
	Complete = "@bootstrap/Complete",
	Start = "@bootstrap/Start"
}

export const reset = () => action("RESET");

export const bootstrap = (data?: SignedInBootstrapData) => async dispatch => {
	if (data == undefined) {
		const api = HostApi.instance;
		const bootstrapCore = await api.send(BootstrapInHostRequestType, undefined);

		if (bootstrapCore.session.userId === undefined) {
			dispatch(bootstrapEssentials(bootstrapCore));
			return;
		}

		const [bootstrapData, { editorContext }] = await Promise.all([
			api.send(BootstrapRequestType, {}),
			api.send(GetActiveEditorContextRequestType, undefined)
		]);
		data = { ...bootstrapData, ...bootstrapCore, editorContext };
	}

	dispatch(bootstrapUsers(data.users));
	dispatch(bootstrapTeams(data.teams));
	dispatch(bootstrapStreams(data.streams));
	dispatch(bootstrapRepos(data.repos));
	// TODO: I think this should be removed and just live with the caps below
	if (data.capabilities && data.capabilities.services)
		dispatch(bootstrapServices(data.capabilities.services));
	dispatch(updateUnreads(data.unreads));
	dispatch(updateProviders(data.providers));
	dispatch(editorContextActions.setEditorContext(data.editorContext));
	dispatch(preferencesActions.setPreferences(data.preferences));

	dispatch(bootstrapEssentials(data));
};

const bootstrapEssentials = (data: BootstrapInHostResponse) => dispatch => {
	dispatch(sessionActions.setSession(data.session));
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
	getState: () => CodeStreamState
) => {
	const response = await HostApi.instance.send(OtcLoginRequestType, {
		code: getState().session.otc!,
		alias: signupInfo !== undefined
	});

	if (isLoginFailResponse(response)) {
		if (response.error === LoginResult.AlreadySignedIn) {
			return dispatch(bootstrap());
		}
		if (
			response.error === LoginResult.ProviderConnectFailed ||
			response.error === LoginResult.ExpiredToken
		) {
			throw response.error;
		}

		return;
	}

	if (signupInfo) {
		HostApi.instance.track("Signup Completed", {
			"Signup Type": signupInfo.type === SignupType.CreateTeam ? "Organic" : "Viral"
		});
	} else {
		HostApi.instance.track("Signed In", { "Auth Type": provider });
		if (localStore.get("enablingRealTime") === true) {
			localStore.delete("enablingRealTime");
			HostApi.instance.track("Slack Chat Enabled");
			const result = await dispatch(sessionActions.onLogin(response));
			dispatch(contextActions.setContext({ chatProviderAccess: "permissive" }));
			return result;
		}
	}

	return await dispatch(sessionActions.onLogin(response));
};
