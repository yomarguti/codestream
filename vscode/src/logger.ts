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
		const section = configuration.name("traceLevel").value;
		if (configuration.changed(e, section)) {
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
		if (Logger.isDebugging) {
			console.log(this.timestamp, ConsolePrefix, message || "", ...params);
		}

		if (this.level !== TraceLevel.Debug) return;

		if (this.output !== undefined) {
			this.output.appendLine(
				`${this.timestamp} ${message || ""} ${this.toLoggableParams(true, params)}`
			);
		}
	}

	static error(ex: Error, message?: string, ...params: any[]): void {
		if (Logger.isDebugging) {
			console.error(this.timestamp, ConsolePrefix, message || "", ...params, ex);
		}

		if (this.level === TraceLevel.Silent && !Logger.isDebugging) return;

		if (this.output !== undefined) {
			this.output.appendLine(
				`${this.timestamp} ${message || ""} ${this.toLoggableParams(false, params)}\n${ex}`
			);
		}

		// Telemetry.trackException(ex);
	}

	static log(message?: any, ...params: any[]): void {
		if (Logger.isDebugging) {
			console.log(this.timestamp, ConsolePrefix, message || "", ...params);
		}

		if (this.level !== TraceLevel.Verbose && this.level !== TraceLevel.Debug) return;

		if (this.output !== undefined) {
			this.output.appendLine(
				`${this.timestamp} ${message || ""} ${this.toLoggableParams(false, params)}`
			);
		}
	}

	static logWithDebugParams(message?: any, ...params: any[]): void {
		if (Logger.isDebugging) {
			console.log(this.timestamp, ConsolePrefix, message || "", ...params);
		}

		if (this.level !== TraceLevel.Verbose && this.level !== TraceLevel.Debug) return;

		if (this.output !== undefined) {
			this.output.appendLine(
				`${this.timestamp} ${message || ""} ${this.toLoggableParams(true, params)}`
			);
		}
	}

	static warn(message?: any, ...params: any[]): void {
		if (Logger.isDebugging) {
			console.warn(this.timestamp, ConsolePrefix, message || "", ...params);
		}

		if (this.level === TraceLevel.Silent) return;

		if (this.output !== undefined) {
			this.output.appendLine(
				`${this.timestamp} ${message || ""} ${this.toLoggableParams(false, params)}`
			);
		}
	}

	static showOutputChannel() {
		if (this.output === undefined) return;

		this.output.show();
	}

	static sanitizeSerializableParam(key: string, value: any) {
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
