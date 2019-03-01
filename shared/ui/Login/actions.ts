import { LoginRequest, LoginRequestType, SignupRequestType } from "../ipc/webview.protocol";
import { logError } from "../logger";
import { bootstrap } from "../store/actions";
import { goToCompleteSignup } from "../store/route/actions";
import { HostApi } from "../webview-api";

export { startSlackSignin } from "../Signup/actions";
export { validateSignup } from "../CompleteSignup/actions";
export { goToSignup } from "../store/route/actions";

export const authenticate = (params: LoginRequest) => async dispatch => {
	const response = await HostApi.instance.send(LoginRequestType, params);
	dispatch(bootstrap(response));
};

export const startSignup = () => async dispatch => {
	try {
		await HostApi.instance.send(SignupRequestType, {});
		dispatch(goToCompleteSignup());
	} catch (error) {
		logError(error);
	}
};
