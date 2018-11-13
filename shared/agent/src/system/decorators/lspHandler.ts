"use strict";
import { RequestType } from "vscode-languageserver-protocol";

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
