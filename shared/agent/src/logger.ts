"use strict";
import { CodeStreamAgent } from "./agent";
// import { Telemetry } from './telemetry';

// const ConsolePrefix = `[CodeStreamAgent]`;

export enum TraceLevel {
	Silent = "silent",
	Errors = "errors",
	Verbose = "verbose",
	Debug = "debug"
}

export interface LogCallerContext {
	correlationId?: number;
	prefix: string;
}

export class Logger {
	static level: TraceLevel = TraceLevel.Silent;
	private static _agent: CodeStreamAgent | undefined;

	static initialize(agent: CodeStreamAgent) {
		this._agent = agent;
	}

	static debug(message: string, ...params: any[]): void;
	static debug(caller: Function, message: string, ...params: any[]): void;
	static debug(callerOrMessage: Function | string, ...params: any[]): void {
		if (this.level !== TraceLevel.Debug && !Logger.isDebugging) return;

		let message;
		if (typeof callerOrMessage === "string") {
			message = callerOrMessage;
		} else {
			message = params.shift();

			const context = this.getCallerContext(callerOrMessage);
			if (context !== undefined) {
				message = `${context.prefix} ${message || ""}`;
			}
		}

		// if (Logger.isDebugging) {
		// 	console.log(this.timestamp, ConsolePrefix, message || "", ...params);
		// }

		if (this._agent !== undefined) {
			this._agent.log(`${this.timestamp} ${message || ""} ${this.toLoggableParams(true, params)}`);
		}
	}

	static error(ex: Error, message?: string, ...params: any[]): void;
	static error(ex: Error, caller: Function, message?: string, ...params: any[]): void;
	static error(ex: Error, callerOrMessage: Function | string | undefined, ...params: any[]): void {
		if (this.level === TraceLevel.Silent && !Logger.isDebugging) return;

		let message;
		if (callerOrMessage === undefined || typeof callerOrMessage === "string") {
			message = callerOrMessage;
		} else {
			message = params.shift();

			const context = this.getCallerContext(callerOrMessage);
			if (context !== undefined) {
				message = `${context.prefix} ${message || ""}`;
			}
		}

		if (message === undefined) {
			const stack = ex.stack;
			if (stack) {
				const match = /.*\s*?at\s(.+?)\s/.exec(stack);
				if (match != null) {
					message = match[1];
				}
			}
		}

		// if (Logger.isDebugging) {
		// 	console.error(this.timestamp, ConsolePrefix, message || "", ...params, ex);
		// }

		if (this._agent !== undefined) {
			this._agent.error(
				`${this.timestamp} ${message || ""} ${this.toLoggableParams(false, params)}\n${ex}`
			);
		}

		// Telemetry.trackException(ex);
	}

	static log(message: string, ...params: any[]): void;
	static log(caller: Function, message: string, ...params: any[]): void;
	static log(callerOrMessage: Function | string, ...params: any[]): void {
		if (
			this.level !== TraceLevel.Verbose &&
			this.level !== TraceLevel.Debug &&
			!Logger.isDebugging
		) {
			return;
		}

		let message;
		if (typeof callerOrMessage === "string") {
			message = callerOrMessage;
		} else {
			message = params.shift();

			const context = this.getCallerContext(callerOrMessage);
			if (context !== undefined) {
				message = `${context.prefix} ${message || ""}`;
			}
		}

		// if (Logger.isDebugging) {
		// 	console.log(this.timestamp, ConsolePrefix, message || "", ...params);
		// }

		if (this._agent !== undefined) {
			this._agent.log(`${this.timestamp} ${message || ""} ${this.toLoggableParams(false, params)}`);
		}
	}

	static logWithDebugParams(message: string, ...params: any[]): void;
	static logWithDebugParams(caller: Function, message: string, ...params: any[]): void;
	static logWithDebugParams(callerOrMessage: Function | string, ...params: any[]): void {
		if (
			this.level !== TraceLevel.Verbose &&
			this.level !== TraceLevel.Debug &&
			!Logger.isDebugging
		) {
			return;
		}

		let message;
		if (typeof callerOrMessage === "string") {
			message = callerOrMessage;
		} else {
			message = params.shift();

			const context = this.getCallerContext(callerOrMessage);
			if (context !== undefined) {
				message = `${context.prefix} ${message || ""}`;
			}
		}

		// if (Logger.isDebugging) {
		// 	console.log(this.timestamp, ConsolePrefix, message || "", ...params);
		// }

		if (this._agent !== undefined) {
			this._agent.log(`${this.timestamp} ${message || ""} ${this.toLoggableParams(true, params)}`);
		}
	}

	static warn(message: string, ...params: any[]): void;
	static warn(caller: Function, message: string, ...params: any[]): void;
	static warn(callerOrMessage: Function | string, ...params: any[]): void {
		if (this.level === TraceLevel.Silent && !Logger.isDebugging) return;

		let message;
		if (typeof callerOrMessage === "string") {
			message = callerOrMessage;
		} else {
			message = params.shift();

			const context = this.getCallerContext(callerOrMessage);
			if (context !== undefined) {
				message = `${context.prefix} ${message || ""}`;
			}
		}

		// if (Logger.isDebugging) {
		// 	console.warn(this.timestamp, ConsolePrefix, message || "", ...params);
		// }

		if (this._agent !== undefined) {
			this._agent.warn(
				`${this.timestamp} ${message || ""} ${this.toLoggableParams(false, params)}`
			);
		}
	}

	static sanitizeSerializableParam(key: string, value: any) {
		return /(password|token)/i.test(key) ? `<${key}>` : value;
	}

	static toLoggableName(instance: { constructor: Function }) {
		const name = instance.constructor != null ? instance.constructor.name : "";
		// Strip webpack module name (since I never name classes with an _)
		const index = name.indexOf("_");
		return index === -1 ? name : name.substr(index + 1);
	}

	private static getCallerContext(caller: Function): LogCallerContext | undefined {
		let context = (caller as any).$log;
		if (context == null && caller.prototype != null) {
			context = caller.prototype.$log;
			if (context == null && caller.prototype.constructor != null) {
				context = caller.prototype.constructor.$log;
			}
		}
		return context;
	}

	private static get timestamp(): string {
		const now = new Date();
		return `[${now
			.toISOString()
			.replace(/T/, " ")
			.replace(/\..+/, "")}:${("00" + now.getUTCMilliseconds()).slice(-3)}]`;
	}

	private static toLoggableParams(debugOnly: boolean, params: any[]) {
		if (
			params.length === 0 ||
			(debugOnly && this.level !== TraceLevel.Debug && !Logger.isDebugging)
		) {
			return "";
		}

		const loggableParams = params
			.map(p => {
				if (typeof p !== "object") return String(p);

				try {
					return JSON.stringify(p, this.sanitizeSerializableParam);
				} catch {
					return `<error>`;
				}
			})
			.join(", ");

		return loggableParams || "";
	}

	private static _isDebugging: boolean | undefined;
	static get isDebugging() {
		if (this._isDebugging === undefined) {
			const env = process.env;
			this._isDebugging =
				env && env.DEBUG_EXT ? env.DEBUG_EXT.toLowerCase().includes("codestream") : false;
		}

		return this._isDebugging;
	}

	static overrideIsDebugging() {
		this._isDebugging = true;
	}
}
