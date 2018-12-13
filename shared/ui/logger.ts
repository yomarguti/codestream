import { ReportingMessageType } from "./shared/agent.protocol";
import WebviewApi from "./webview-api";

// TODO: move logging into middleware so the host's instance of WebviewApi can be injected
const api = new WebviewApi();

export function logError(error: string | Error, extra?: object) {
	console.error(error, extra);
	if (typeof error === "string") {
		api.reportMessage(ReportingMessageType.Error, error, extra);
	} else {
		const info = extra ? extra : {};
		api.reportMessage(ReportingMessageType.Error, error.message, {
			...info,
			stackTrace: error.stack
		});
	}
}

export function logWarning(message: string, extra?: object) {
	console.warn(message, extra);
	api.reportMessage(ReportingMessageType.Warning, message, extra);
}
