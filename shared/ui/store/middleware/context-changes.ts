/// <reference path="../../@types/window.d.ts"/>
import { WebviewDidChangeContextNotificationType } from "../../ipc/webview.protocol";
import { HostApi } from "../../webview-api";
import { ContextActionsType, ContextState } from "../context/types";
import { CodeStreamState } from "..";
import { Dispatch, MiddlewareAPI } from "redux";
import { UIStateRequestType } from '../../protocols/agent/agent.protocol';

export const contextChangeObserver = (store: MiddlewareAPI<any, CodeStreamState>) => (
	next: Dispatch
) => (action: { type: string }) => {
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

			// alert the agent so it may use more aggressive behaviors based upon
			// which UI the user is looking at
			void HostApi.instance.send(UIStateRequestType, {
				context: newContext
			});
		}
	});

	return result;
};

function notEqual<K extends keyof ContextState>(
	oldContext: ContextState,
	newContext: ContextState,
	blackList: K[] = []
) {
	return Object.entries(oldContext).some(
		([key, value]) => !(blackList as string[]).includes(key) && value !== newContext[key]
	);
}
