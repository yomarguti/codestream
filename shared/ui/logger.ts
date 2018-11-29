import EventEmitter from "./event-emitter";

enum LogType {
	Error = "error"
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
