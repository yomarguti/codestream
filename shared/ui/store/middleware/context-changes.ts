import { EventEmitter } from "../../event-emitter";
import { ContextActionsType, State as Context } from "../context/types";

export const contextChangeObserver = store => next => (action: { type: string }) => {
	if (action.type === ContextActionsType.SetFocusState) {
		return;
	}
	const oldContext = store.getState().context;
	const result = next(action);
	const newContext = store.getState().context;

	window.requestIdleCallback(() => {
		if (notEqual(oldContext, newContext)) {
			EventEmitter.emit("interaction:context-state-changed", newContext);
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

type RequestIdleCallbackHandle = any;
interface RequestIdleCallbackOptions {
	timeout: number;
}
interface RequestIdleCallbackDeadline {
	readonly didTimeout: boolean;
	timeRemaining(): number;
}

declare global {
	interface Window {
		requestIdleCallback(callback: (deadline: RequestIdleCallbackDeadline) => void, opts?: RequestIdleCallbackOptions): RequestIdleCallbackHandle;
		cancelIdleCallback(handle: RequestIdleCallbackHandle): void;
	}
}
