/// <reference path="../../@types/window.d.ts"/>
import { WebviewDidChangeContextNotificationType } from "../../ipc/webview.protocol";
import { HostApi } from "../../webview-api";
import { ContextActionsType, State as Context } from "../context/types";

export const contextChangeObserver = store => next => (action: { type: string }) => {
	if (action.type === ContextActionsType.SetFocusState) {
		return next(action);
	}
	const oldContext = store.getState().context;
	const result = next(action);
	const newContext = store.getState().context;

	window.requestIdleCallback(() => {
		if (notEqual(oldContext, newContext)) {
			HostApi.instance.notify(WebviewDidChangeContextNotificationType, {
				context: newContext
			});
		}
	});

	return result;
};

function notEqual<K extends keyof Context>(
	oldContext: Context,
	newContext: Context,
	blackList: K[] = []
) {
	return Object.entries(oldContext).some(
		([key, value]) => !(blackList as string[]).includes(key) && value !== newContext[key]
	);
}
