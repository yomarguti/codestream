"use strict";
import { RequestHandler0, RequestType } from "vscode-languageserver-protocol";
import { CodeStreamAgent } from "../../agent";

export interface LspHandler {
	type: RequestType<any, any, void, void>;
	method: RequestHandler0<{}, {}>;
	target: any;
}

const handlerRegistry = new Map<any, LspHandler[]>();
export function registerDecoratedHandlers(agent: CodeStreamAgent): void {
	for (const [_, handlers] of handlerRegistry) {
		for (const handler of handlers) {
			agent.registerHandler(handler.type, handler.method);
		}
	}
	handlerRegistry.clear();
}

export function lsp<T extends object>(target: T) {
	return new Proxy(target, {
		construct(target, args: any[]) {
			const instance = new (target as any)(...args);

			const handlers = handlerRegistry.get(target);
			if (handlers !== undefined) {
				for (const handler of handlers) {
					handler.method = handler.method.bind(instance);
				}
			}

			return instance;
		}
	});
}

export function lspHandler(type: RequestType<any, any, void, void>): Function {
	return (target: any, key: string, descriptor: PropertyDescriptor) => {
		if (!descriptor || typeof descriptor.value !== "function") {
			throw new Error("Not supported");
		}

		const targetKey = target.constructor;

		let handlers = handlerRegistry.get(targetKey);
		if (handlers === undefined) {
			handlers = [];
			handlerRegistry.set(targetKey, handlers);
		}

		handlers.push({
			type: type,
			method: descriptor.value,
			target: target.constructor
		});
	};
}
