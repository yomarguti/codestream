"use strict";
import { RequestType } from "vscode-languageserver-protocol";
import { Logger, TraceLevel } from "../logger";
import { Functions } from "./function";
import { Strings } from "./string";

export interface LspHandler {
	type: RequestType<any, any, void, void>;
	key: string;
	method: Function;
}

export function lspHandler(type: RequestType<any, any, void, void>): Function {
	return (target: any, key: string, descriptor: PropertyDescriptor) => {
		if (!(typeof descriptor.value === "function")) throw new Error("not supported");

		const fn = descriptor.value;

		if (target.handlerRegistry === undefined) {
			target.handlerRegistry = [];
		}

		target.handlerRegistry.push({
			type: type,
			key: key,
			method: fn
		});
	};
}

let correlationCounter = 0;

export function log(
	options: {
		args?: boolean;
		decorate?(...args: any[]): string;
		correlate?: boolean;
		enter?(...args: any[]): string;
		exit?(result: any): string;
		timed?: boolean;
	} = { args: true, timed: true }
) {
	options = { args: true, timed: true, ...options };

	return (target: any, key: string, descriptor: PropertyDescriptor) => {
		if (!(typeof descriptor.value === "function")) throw new Error("not supported");

		const fn = descriptor.value;

		const isClass = Boolean(target && target.constructor);
		const methodName = isClass ? `${target.constructor.name}.${key}` : key;

		// If we are timing, get the class fn in order to store the correlationId if needed
		const classFn = isClass && (options.correlate || options.timed) ? target[key] : undefined;

		const fnBody = fn.toString().replace(/((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm, "");
		const parameters: string[] =
			fnBody.slice(fnBody.indexOf("(") + 1, fnBody.indexOf(")")).match(/([^\s,]+)/g) || [];

		descriptor.value = function(this: any, ...args: any[]) {
			if (Logger.level === TraceLevel.Verbose || Logger.level === TraceLevel.Debug) {
				let correlationId;
				let name: string;
				if (options.correlate || options.timed) {
					correlationId = correlationCounter++;
					name = `[${correlationId.toString(16)}] ${methodName}`;
				} else {
					name = methodName;
				}

				if (options.correlate) {
					(isClass ? target[key] : fn).logCorrelationId = correlationId;
				}

				if (options.decorate !== undefined) {
					name = `${name}${options.decorate(...args)}`;
				}

				if (!options.args || args.length === 0) {
					if (options.enter !== undefined) {
						Logger.log(name, options.enter(...args));
					} else {
						Logger.log(name);
					}
				} else {
					let loggableParams = args
						.map((v: any, index: number) => {
							const loggable =
								typeof v === "object"
									? JSON.stringify(v, this.sanitizeSerializableParam)
									: String(v);

							const p = parameters[index];
							return p ? `${p}=${loggable}` : loggable;
						})
						.join(", ");

					if (options.enter !== undefined) {
						loggableParams = `${options.enter(...args)} ${loggableParams}`;
					}
					Logger.logWithDebugParams(name, loggableParams);
				}

				if (options.timed || options.exit !== undefined) {
					const start = options.timed ? process.hrtime() : undefined;
					const result = fn.apply(this, args);

					if (
						result != null &&
						(typeof result === "object" || typeof result === "function") &&
						typeof result.then === "function"
					) {
						const promise = result.then((r: any) => {
							const timing =
								start !== undefined ? ` \u2022 ${Strings.getDurationMilliseconds(start)} ms` : "";
							let exit;
							try {
								exit = options.exit !== undefined ? options.exit(r) : "";
							} catch (ex) {
								exit = `@log.exit error: ${ex}`;
							}
							Logger.log(name, `completed${timing}${exit}`);
						});

						if (typeof promise.catch === "function") {
							promise.catch((ex: any) => {
								const timing =
									start !== undefined ? ` \u2022 ${Strings.getDurationMilliseconds(start)} ms` : "";
								Logger.error(ex, name, `failed${timing}`);
							});
						}
					} else {
						const timing =
							start !== undefined ? ` \u2022 ${Strings.getDurationMilliseconds(start)} ms` : "";
						let exit;
						try {
							exit = options.exit !== undefined ? options.exit(result) : "";
						} catch (ex) {
							exit = `@log.exit error: ${ex}`;
						}
						Logger.log(methodName, `completed${timing}${exit}`);
					}
					return result;
				}
			}

			return fn.apply(this, args);
		};
	};
}

function _memoize(fn: Function, key: string): Function {
	const memoizeKey = `$memoize$${key}`;

	return function(this: any, ...args: any[]) {
		if (!this.hasOwnProperty(memoizeKey)) {
			Object.defineProperty(this, memoizeKey, {
				configurable: false,
				enumerable: false,
				writable: false,
				value: fn.apply(this, args)
			});
		}

		return this[memoizeKey];
	};
}

export const memoize = Functions.decorate(_memoize);
