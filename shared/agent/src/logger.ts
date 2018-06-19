"use strict";
import { CodeStreamAgent } from "./agent";
// import { Telemetry } from './telemetry';

const ConsolePrefix = `[CodeStreamAgent]`;

const isDebuggingRegex = /^--inspect(-brk)?=?/;

export enum TraceLevel {
	Silent = "silent",
	Errors = "errors",
	Verbose = "verbose",
	Debug = "debug"
}

export class Logger {
	static level: TraceLevel = TraceLevel.Silent;
	private static _agent: CodeStreamAgent | undefined;

	static initialize(agent: CodeStreamAgent) {
		this._agent = agent;
	}

	static log(message?: any, ...params: any[]): void {
		if (this.level !== TraceLevel.Verbose && this.level !== TraceLevel.Debug) return;

		if (Logger.isDebugging) {
			console.log(this.timestamp, ConsolePrefix, message, ...params);
		}

		if (this._agent !== undefined) {
			this._agent.log(
				(Logger.isDebugging ? [this.timestamp, message, ...params] : [message, ...params]).join(" ")
			);
		}
	}

	static error(ex: Error, classOrMethod?: string, ...params: any[]): void {
		if (this.level === TraceLevel.Silent) return;

		if (Logger.isDebugging) {
			console.error(this.timestamp, ConsolePrefix, classOrMethod, ...params, ex);
		}

		if (this._agent !== undefined) {
			this._agent.error(
				(Logger.isDebugging
					? [this.timestamp, classOrMethod, ...params, ex]
					: [classOrMethod, ...params, ex]
				).join(" ")
			);
		}

		// Telemetry.trackException(ex);
	}

	static warn(message?: any, ...params: any[]): void {
		if (this.level === TraceLevel.Silent) return;

		if (Logger.isDebugging) {
			console.warn(this.timestamp, ConsolePrefix, message, ...params);
		}

		if (this._agent !== undefined) {
			this._agent.warn(
				(Logger.isDebugging ? [this.timestamp, message, ...params] : [message, ...params]).join(" ")
			);
		}
	}

	private static get timestamp(): string {
		const now = new Date();
		return `[${now
			.toISOString()
			.replace(/T/, " ")
			.replace(/\..+/, "")}:${("00" + now.getUTCMilliseconds()).slice(-3)}]`;
	}

	private static _isDebugging: boolean | undefined;
	static get isDebugging() {
		if (this._isDebugging === undefined) {
			const args = process.execArgv;

			this._isDebugging = args ? args.some(arg => isDebuggingRegex.test(arg)) : false;
		}

		return this._isDebugging;
	}
}
