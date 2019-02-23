import { ReportingMessageType, ReportMessageRequestType } from "@codestream/protocols/agent";
import { HostApi } from "./webview-api";

export function logError(error: string | Error, extra?: object) {
	console.error(error, extra);

	HostApi.instance.send(ReportMessageRequestType, {
		source: "webview",
		type: ReportingMessageType.Error,
		message: typeof error === "string" ? error : error.message,
		extra: typeof error === "string" ? extra : { ...(extra || {}), stackTrace: error.stack }
	});
}
