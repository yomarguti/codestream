import EventEmitter from "./event-emitter";

enum LogType {
	Error = "error",
	Warning = "warning"
}

function sendLog(type: LogType, message: string, extra?: object) {
	EventEmitter.emit("log", { type, message, extra });
}

export function logError(error: string | Error, extra?: object) {
	console.error(error, extra);
	if (typeof error === "string") {
		sendLog(LogType.Error, error, extra);
	} else {
		const info = extra ? extra : {};
		sendLog(LogType.Error, error.message, { ...info, stackTrace: error.stack });
	}
}

// TODO: agent/extension aren't handling this
export function logWarning(message: string, extra?: object) {
	console.warn(message, extra);
	sendLog(LogType.Warning, message, extra);
}
