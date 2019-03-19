/// <reference path="../../@types/window.d.ts"/>
import { BootstrapActionType } from "../actions";
import { Middleware } from "redux";
import { fetchCodemarks } from "@codestream/webview/Stream/actions";
import { State as SessionState } from "../session/types";

// Do stuff based on data and not UI details
export const sideEffects: Middleware = ({ dispatch, getState }) => next => action => {
	// Preempt fetching codemarks
	if (action.type === BootstrapActionType.Complete) {
		const session: SessionState = getState().session;
		if (session.userId) {
			window.requestIdleCallback(() => {
				// TODO: redundant calls can be made by both the components that need the data and here
				fetchCodemarks()(dispatch);
			});
		}
	}
	return next(action);
};
