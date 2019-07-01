import { action } from "../common";
import { SessionActionType, SessionState } from "./types";
import { HostApi } from "../../webview-api";
import { bootstrap } from "../actions";
import { logError } from "@codestream/webview/logger";
import {
	GetActiveEditorContextRequestType,
	BootstrapInHostRequestType
} from "@codestream/protocols/webview";
import {
	LoginSuccessResponse,
	BootstrapRequestType,
	PasswordLoginRequestType,
	isLoginFailResponse,
	PasswordLoginRequest,
	TokenLoginRequestType
} from "@codestream/protocols/agent";
import { LoginResult } from "@codestream/protocols/api";
import { goToTeamCreation } from "../context/actions";
import { CodeStreamState } from "..";

export const reset = () => action("RESET");

export const setSession = (session: Partial<SessionState>) =>
	action(SessionActionType.Set, session);

export const authenticate = (params: Pick<PasswordLoginRequest, "email" | "password">) => async (
	dispatch,
	getState: () => CodeStreamState
) => {
	const api = HostApi.instance;
	try {
		debugger;
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
