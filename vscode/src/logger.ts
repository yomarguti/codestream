"use strict";
import { ConfigurationChangeEvent, ExtensionContext, OutputChannel, window } from "vscode";
import { configuration, TraceLevel } from "./configuration";
import { extensionOutputChannelName } from "./constants";
// import { Telemetry } from './telemetry';

const ConsolePrefix = `[${extensionOutputChannelName}]`;

const isDebuggingRegex = /\bcodestream\b/i;

export class Logger {
	static level: TraceLevel = TraceLevel.Silent;
	static output: OutputChannel | undefined;

	static configure(context: ExtensionContext) {
		context.subscriptions.push(configuration.onDidChange(this.onConfigurationChanged, this));
		this.onConfigurationChanged(configuration.initializingChangeEvent);
	}

	private static onConfigurationChanged(e: ConfigurationChangeEvent) {
		const initializing = configuration.initializing(e);

		const section = configuration.name("traceLevel").value;
		if (initializing || configuration.changed(e, section)) {
			this.level = configuration.get<TraceLevel>(section);

			if (this.level === TraceLevel.Silent) {
				if (this.output !== undefined) {
					this.output.dispose();
					this.output = undefined;
				}
			} else {
				this.output = this.output || window.createOutputChannel(extensionOutputChannelName);
			}
		}
	}

	static debug(message?: any, ...params: any[]): void {
		if (this.level !== TraceLevel.Debug && !Logger.isDebugging) return;

		if (Logger.isDebugging) {
			console.log(this.timestamp, ConsolePrefix, message, ...params);
		}

		if (this.output !== undefined) {
			this.output.appendLine(
				[this.timestamp, message, this.toLoggableParams(true, params)].join(" ")
			);
		}
	}

	static error(ex: Error, classOrMethod?: string, ...params: any[]): void {
		if (this.level === TraceLevel.Silent && !Logger.isDebugging) return;

		if (Logger.isDebugging) {
			console.error(this.timestamp, ConsolePrefix, classOrMethod, ...params, ex);
		}

		if (this.output !== undefined) {
			this.output.appendLine(
				[this.timestamp, classOrMethod, this.toLoggableParams(false, params), "\n", ex].join(" ")
			);
		}

		// Telemetry.trackException(ex);
	}

	static log(message?: any, ...params: any[]): void {
		if (
			this.level !== TraceLevel.Verbose &&
			this.level !== TraceLevel.Debug &&
			!Logger.isDebugging
		) {
			return;
		}

		if (Logger.isDebugging) {
			console.log(this.timestamp, ConsolePrefix, message, ...params);
		}

		if (this.output !== undefined) {
			this.output.appendLine(
				[this.timestamp, message, this.toLoggableParams(false, params)].join(" ")
			);
		}
	}

	static logWithDebugParams(message?: any, ...params: any[]): void {
		if (
			this.level !== TraceLevel.Verbose &&
			this.level !== TraceLevel.Debug &&
			!Logger.isDebugging
		) {
			return;
		}

		// if (Logger.isDebugging) {
		// 	console.log(this.timestamp, ConsolePrefix, message, ...params);
		// }

		if (this.output !== undefined) {
			this.output.appendLine(
				[this.timestamp, message, this.toLoggableParams(true, params)].join(" ")
			);
		}
	}

	static warn(message?: any, ...params: any[]): void {
		if (this.level === TraceLevel.Silent && !Logger.isDebugging) return;

		if (Logger.isDebugging) {
			console.warn(this.timestamp, ConsolePrefix, message, ...params);
		}

		if (this.output !== undefined) {
			this.output.appendLine(
				[this.timestamp, message, this.toLoggableParams(false, params)].join(" ")
			);
		}
	}

	static showOutputChannel() {
		if (this.output === undefined) return;

		this.output.show();
	}

	private static sanitizeSerializableParam(key: string, value: any) {
		return /(password|token)/i.test(key) ? `<${key}>` : value;
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
			.map(
				p => (typeof p === "object" ? JSON.stringify(p, this.sanitizeSerializableParam) : String(p))
			)
			.join(", ");

		return loggableParams || "";
	}

	private static _isDebugging: boolean | undefined;
	static get isDebugging() {
		if (this._isDebugging === undefined) {
			const env = process.env;
			this._isDebugging =
				env && env.VSCODE_DEBUGGING_EXTENSION
					? isDebuggingRegex.test(env.VSCODE_DEBUGGING_EXTENSION)
					: false;
		}

		return this._isDebugging;
	}

	static overrideIsDebugging() {
		this._isDebugging = true;
	}
}
