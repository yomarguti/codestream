import { LoginRequest, LoginRequestType } from "@codestream/protocols/webview";
import { HostApi } from "../webview-api";
import { bootstrap } from "../store/actions";
import { LoginResult } from "@codestream/protocols/api";
import { goToTeamCreation } from "../store/context/actions";

export const authenticate = (params: LoginRequest) => async dispatch => {
	try {
		const response = await HostApi.instance.send(LoginRequestType, params);
		HostApi.instance.track("Signed In", { "Auth Type": "CodeStream" });
		dispatch(bootstrap(response));
	} catch (error) {
		if (error.status === LoginResult.NotOnTeam) {
			dispatch(goToTeamCreation({ loggedIn: true, email: params.email, token: error.token }));
		} else throw error;
	}
};
