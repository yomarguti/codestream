import EventEmitter from "../../event-emitter";
import { action, ThunkExtras } from "../common";
import { ContextActionsType, State } from "./types";

export { reset } from "../actions";

export const setContext = (payload: State) => action(ContextActionsType.SetContext, payload);

export const _openPanel = (panel: string) => action(ContextActionsType.OpenPanel, panel);
export const openPanel = (panel: string) => (dispatch, getState) => {
	if (getState().context.panelStack[0] !== panel) {
		const result = dispatch(_openPanel(panel));
		EventEmitter.emit("interaction:active-panel-changed", getState().context.panelStack);
		return result;
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

export const fileChanged = editor => setCurrentFile(editor.fileName, editor.fileStreamId);

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

export const connectProvider = (name: string) => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	const { context, users, session } = getState();
	const user = users[session.userId];
	if (((user.providerInfo && user.providerInfo[context.currentTeamId]) || {})[name]) {
		return dispatch(setIssueProvider(name));
	}
	await api.connectService(name);
	return dispatch(setIssueProvider(name));
};

export const setIssueProvider = (name: string | undefined) =>
	action(ContextActionsType.SetIssueProvider, name);
