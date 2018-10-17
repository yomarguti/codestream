"use strict";
import { RequestType } from "vscode-languageserver-protocol";
import { Logger, TraceLevel } from "../logger";
import { Functions } from "./function";

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

export function log() {
	return (target: any, name: string, descriptor: PropertyDescriptor) => {
		if (!(typeof descriptor.value === "function")) throw new Error("not supported");

		const fn = descriptor.value;

		if (target.constructor && target.constructor.name) {
			name = `${target.constructor.name}.${name}`;
		}

		const fnBody = fn.toString().replace(/((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm, "");
		const parameters: string[] =
			fnBody.slice(fnBody.indexOf("(") + 1, fnBody.indexOf(")")).match(/([^\s,]+)/g) || [];

		descriptor.value = function(this: any, ...args: any[]) {
			if (Logger.level === TraceLevel.Verbose || Logger.level === TraceLevel.Debug) {
				if (args.length === 0) {
					Logger.log(name);
				} else {
					const loggableParams = args
						.map((v: any, index: number) => {
							const loggable =
								typeof v === "object"
									? JSON.stringify(v, this.sanitizeSerializableParam)
									: String(v);

							const p = parameters[index];
							return p ? `${p}=${loggable}` : loggable;
						})
						.join(", ");
					Logger.logWithDebugParams(name, loggableParams);
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
