import { action } from "../common";
import { SessionActionType, SessionState } from "./types";
import { HostApi } from "../../webview-api";
import { CompleteSignupRequestType } from "@codestream/webview/ipc/host.protocol";
import { bootstrap } from "../actions";
import { logError } from "@codestream/webview/logger";

export const reset = () => action("RESET");

export const setSession = (session: Partial<SessionState>) =>
	action(SessionActionType.Set, session);

export const completeSignup = (
	email: string,
	token: string,
	teamId: string,
	extra: { createdTeam: boolean }
) => async dispatch => {
	try {
		const bootstrapData = await HostApi.instance.send(CompleteSignupRequestType, {
			email,
			token,
			teamId
		});
		HostApi.instance.track("Signup Completed", {
			"Signup Type": extra.createdTeam ? "Organic" : "Viral"
		});
		dispatch(bootstrap(bootstrapData));
	} catch (error) {
		logError("There was an error completing signup", error);
		throw error;
	}
};
