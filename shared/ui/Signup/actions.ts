import { SlackLoginRequestType } from "../ipc/webview.protocol";
import { logError } from "../logger";
import { goToCompleteSignup } from "../store/route/actions";
import { HostApi } from "../webview-api";

export { goToLogin, goToSlackInfo } from "../store/route/actions";
export { startSignup } from "../Login/actions";

export const startSlackSignin = () => async dispatch => {
	try {
		await HostApi.instance.send(SlackLoginRequestType, {});
		return dispatch(goToCompleteSignup({ authType: "slack" }));
	} catch (error) {
		logError(`Unable to start slack sign in: ${error}`);
	}
};
