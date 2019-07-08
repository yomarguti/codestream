import {
	PasswordLoginRequest,
	PasswordLoginRequestType,
	isLoginFailResponse,
	LoginSuccessResponse,
	BootstrapRequestType,
	TokenLoginRequestType,
	OpenUrlRequestType,
	OtcLoginRequestType
} from "@codestream/protocols/agent";
import { CodeStreamState } from "../store";
import { HostApi } from "../webview-api";
import { LoginResult } from "@codestream/protocols/api";
import { goToTeamCreation, goToSSOAuth, setContext } from "../store/context/actions";
import { GetActiveEditorContextRequestType } from "../ipc/host.protocol.editor";
import { BootstrapInHostRequestType } from "../ipc/host.protocol";
import { bootstrap } from "../store/actions";
import { logError } from "../logger";
import { ChatProviderAccess } from "../store/context/types";
import { emptyObject, uuid } from "../utils";
import { localStore } from "../utilities/storage";
import { setSession } from "../store/session/actions";

export enum SignupType {
	JoinTeam = "joinTeam",
	CreateTeam = "createTeam"
}

export interface ValidateSignupInfo {
	type: SignupType;
}

export const startSSOSignin = (
	provider: string,
	info?: ValidateSignupInfo,
	access?: ChatProviderAccess
) => async (dispatch, getState: () => CodeStreamState) => {
	const { context, configs, session } = getState();
	if (access == undefined) {
		access = context.chatProviderAccess;
	}

	const queryString = access === "strict" ? "access=strict&" : "";

	try {
		await HostApi.instance.send(OpenUrlRequestType, {
			url: `${configs.serverUrl}/web/provider-auth/${provider}?${queryString}signupToken=${
				session.otc
			}`
		});
		return dispatch(goToSSOAuth(provider, { ...(info || emptyObject), mode: access }));
	} catch (error) {
		logError(`Unable to start ${provider} sign in: ${error}`);
	}
};

export const authenticate = (params: Pick<PasswordLoginRequest, "email" | "password">) => async (
	dispatch,
	getState: () => CodeStreamState
) => {
	const api = HostApi.instance;
	try {
		const response = await api.send(PasswordLoginRequestType, {
			...params,
			team: getState().configs.team
		});
		if (isLoginFailResponse(response)) {
			throw response.error;
		}

		api.track("Signed In", { "Auth Type": "CodeStream" });

		return dispatch(onLogin(response));
	} catch (error) {
		if (error.status === LoginResult.NotOnTeam) {
			dispatch(goToTeamCreation({ loggedIn: true, email: params.email, token: error.token }));
		} else throw error;
	}
};

export const onLogin = (response: LoginSuccessResponse) => async dispatch => {
	const api = HostApi.instance;

	const [bootstrapData, { editorContext }, bootstrapCore] = await Promise.all([
		api.send(BootstrapRequestType, {}),
		api.send(GetActiveEditorContextRequestType, undefined),
		api.send(BootstrapInHostRequestType, undefined)
	]);

	await dispatch(
		bootstrap({
			...bootstrapCore,
			...bootstrapData,
			editorContext,
			session: { ...bootstrapCore.session, userId: response.state.userId },
			capabilities: response.state.capabilities,
			context: { currentTeamId: response.state.teamId }
		})
	);
};

export const completeSignup = (
	email: string,
	token: string,
	teamId: string,
	extra: { createdTeam: boolean }
) => async (dispatch, getState: () => CodeStreamState) => {
	const response = await HostApi.instance.send(TokenLoginRequestType, {
		token: {
			value: token,
			email,
			url: getState().configs.serverUrl
		},
		teamId
	});

	if (isLoginFailResponse(response)) {
		logError("There was an error completing signup", response);
		throw response.error;
	}

	HostApi.instance.track("Signup Completed", {
		"Signup Type": extra.createdTeam ? "Organic" : "Viral"
	});

	dispatch(onLogin(response));
};

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
			dispatch(setSession({ otc: uuid() }));
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
			const result = await dispatch(onLogin(response));
			dispatch(setContext({ chatProviderAccess: "permissive" }));
			return result;
		}
	}

	return await dispatch(onLogin(response));
};
