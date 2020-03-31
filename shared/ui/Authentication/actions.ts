import {
	PasswordLoginRequest,
	PasswordLoginRequestType,
	isLoginFailResponse,
	LoginSuccessResponse,
	BootstrapRequestType,
	TokenLoginRequestType,
	OpenUrlRequestType,
	OtcLoginRequestType,
	TokenLoginRequest
} from "@codestream/protocols/agent";
import { CodeStreamState } from "../store";
import { HostApi } from "../webview-api";
import { LoginResult } from "@codestream/protocols/api";
import {
	goToTeamCreation,
	goToSSOAuth,
	setContext,
	SupportedSSOProvider,
	goToSignup,
	goToLogin,
	goToSetPassword
} from "../store/context/actions";
import { GetActiveEditorContextRequestType } from "../ipc/host.protocol.editor";
import { BootstrapInHostRequestType } from "../ipc/host.protocol";
import { bootstrap } from "../store/actions";
import { logError } from "../logger";
import { ChatProviderAccess } from "../store/context/types";
import { emptyObject, uuid } from "../utils";
import { localStore } from "../utilities/storage";
import { setSession, setMaintenanceMode } from "../store/session/actions";

export enum SignupType {
	JoinTeam = "joinTeam",
	CreateTeam = "createTeam",
	Login = "login"
}

export interface ValidateSignupInfo {
	type: SignupType;
	inviteCode?: string;
}

export const startSSOSignin = (
	provider: SupportedSSOProvider,
	info?: ValidateSignupInfo,
	access?: ChatProviderAccess
) => async (dispatch, getState: () => CodeStreamState) => {
	const { context, configs, session } = getState();
	if (access == undefined) {
		access = context.chatProviderAccess;
	}

	const query: { [key: string]: string } = {};
	if (info && info.type === SignupType.Login) {
		query.noSignup = "1";
	}
	if (session.otc) {
		query.signupToken = session.otc;
	}
	if (access === "strict") {
		query.access = "string";
	}
	if (info && info.inviteCode) {
		query.inviteCode = info.inviteCode;
	}
	const queryString = Object.keys(query)
		.map(key => `${key}=${query[key]}`)
		.join("&");

	try {
		await HostApi.instance.send(OpenUrlRequestType, {
			url: encodeURI(`${configs.serverUrl}/web/provider-auth/${provider}?${queryString}`)
		});
		return dispatch(goToSSOAuth(provider, { ...(info || emptyObject), mode: access }));
	} catch (error) {
		logError(`Unable to start ${provider} sign in: ${error}`);
	}
};

export type PasswordLoginParams = Pick<PasswordLoginRequest, "email" | "password">;

export const authenticate = (params: PasswordLoginParams | TokenLoginRequest) => async (
	dispatch,
	getState: () => CodeStreamState
) => {
	const api = HostApi.instance;
	const response = await api.send(
		(params as any).password ? PasswordLoginRequestType : TokenLoginRequestType,
		{
			...params,
			team: getState().configs.team
		}
	);

	if (isLoginFailResponse(response)) {
		if (getState().session.inMaintenanceMode && response.error !== LoginResult.MaintenanceMode) {
			dispatch(setMaintenanceMode(false));
		}

		switch (response.error) {
			case LoginResult.MaintenanceMode:
				return dispatch(setMaintenanceMode(true, params));
			case LoginResult.MustSetPassword:
				return dispatch(goToSetPassword({ email: (params as PasswordLoginParams).email }));
			case LoginResult.NotOnTeam:
				return dispatch(
					goToTeamCreation({
						loggedIn: true,
						// since we're sure the error is NotOnTeam, params below must be email/password because token
						// login is for resuming previous sessions and this error means you haven't ever fully signed into the extension
						email: (params as PasswordLoginParams).email,
						token: response.extra.token
					})
				);
			default:
				throw response.error;
		}
	}

	api.track("Signed In", { "Auth Type": "CodeStream" });

	return dispatch(onLogin(response));
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
		if (getState().session.inMaintenanceMode && response.error !== LoginResult.MaintenanceMode) {
			dispatch(setMaintenanceMode(false));
		}

		switch (response.error) {
			case LoginResult.MaintenanceMode:
				return dispatch(setMaintenanceMode(true));
			case LoginResult.MustSetPassword:
				return dispatch(goToSetPassword(response.extra));
			case LoginResult.SignupRequired:
				return dispatch(goToSignup({ type: SignupType.CreateTeam }));
			case LoginResult.SignInRequired:
				return dispatch(goToLogin());
			case LoginResult.AlreadySignedIn:
				return dispatch(bootstrap());
			case LoginResult.NotOnTeam:
				return dispatch(
					goToTeamCreation({
						email: response.extra && response.extra.email,
						token: response.extra && response.extra.token
					})
				);
			case LoginResult.ProviderConnectFailed:
			// @ts-ignore - reset the otc and cascade to the default case
			case LoginResult.ExpiredToken:
				dispatch(setSession({ otc: uuid() }));
			default:
				throw response.error;
		}
	}

	if (signupInfo && signupInfo.type !== SignupType.Login) {
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
