import EventEmitter from "../../event-emitter";
import { action } from "../common";
import { ContextActionsType, State } from "./types";

export const setContext = (payload: State) => action(ContextActionsType.SetContext, payload);

export const _openPanel = (panel: string) => action(ContextActionsType.OpenPanel, panel);
export const openPanel = (panel: string) => (dispatch, getState) => {
	if (getState().context.panelStack[0] !== panel) {
		EventEmitter.emit("interaction:active-panel-changed", getState().context.panelStack);
		return dispatch(_openPanel(panel));
	}
};

export const _closePanel = () => action(ContextActionsType.ClosePanel);
export const closePanel = () => (dispatch, getState) => {
	EventEmitter.emit("interaction:active-panel-changed", getState().context.panelStack);
	return dispatch(_closePanel());
};

export const focus = () => action(ContextActionsType.SetFocusState, true);

export const blur = () => action(ContextActionsType.SetFocusState, false);

export function setThread(streamId: string, threadId: string | null = null) {
	return action(ContextActionsType.SetThread, { streamId, threadId });
}

export const setCodemarkFileFilter = (value: string) =>
	action(ContextActionsType.SetCodeMarkFileFilter, value);

export const setCodemarkTypeFilter = (value: string) =>
	action(ContextActionsType.SetCodemarkTypeFilter, value);

export const setChannelFilter = (value: string) =>
	action(ContextActionsType.SetChannelFilter, value);

export const setCurrentFile = (file = "", fileStreamId?: string) =>
	action(ContextActionsType.SetCurrentFile, { file, fileStreamId });

export const _setCurrentStream = (streamId: string) =>
	action(ContextActionsType.SetCurrentStream, streamId);
export const setCurrentStream = streamId => (dispatch, getState) => {
	const { context } = getState();
	// don't set the stream ID unless it actually changed
	if (context.currentStreamId !== streamId) {
		EventEmitter.emit("interaction:changed-active-stream", streamId);
		return dispatch(_setCurrentStream(streamId));
	}
};
