import EventEmitter from "./event-emitter";

enum LogType {
	Error = "error"
}

class Logger {
	error(error: Error, info: any) {
		console.error(error);
		this.sendLog(LogType.Error, error.message, info);
	}

	private sendLog(type: LogType, message: string, extra?: object) {
		EventEmitter.emit("log", { type, message, extra });
	}
}

const logger = new Logger();
export default logger;
