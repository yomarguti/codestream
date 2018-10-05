"use strict";
import { RequestType } from "vscode-languageserver-protocol";
import { Functions } from "./function";

export interface LspHandler {
	type: RequestType<any, any, void, void>;
	key: string;
	method: Function;
}

export function lspHandler(type: RequestType<any, any, void, void>): Function {
	return (target: any, key: string, descriptor: PropertyDescriptor) => {
		if (!(typeof descriptor.value === "function")) throw new Error("not supported");

		const method = descriptor.value;

		if (target.handlerRegistry === undefined) {
			target.handlerRegistry = [];
		}

		target.handlerRegistry.push({
			type: type,
			key: key,
			method: method
		});
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
