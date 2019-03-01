import { bootstrap } from "../store/actions";
export { startSignup } from "../Login/actions";
export { goToLogin } from "../store/route/actions";
import { CompleteSignupRequestType } from "../ipc/webview.protocol";
import { HostApi } from "../webview-api";

export const validateSignup = (token: string) => async dispatch => {
	const response = await HostApi.instance.send(CompleteSignupRequestType, { token });
	await dispatch(bootstrap(response));
};
