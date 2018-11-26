import EventEmitter from "../../event-emitter";

export enum Type {
	SetThread = "SET_CURRENT_THREAD",
	SetCodeMarkFileFilter = "SET_CODEMARK_FILE_FILTER",
	SetCodemarkTypeFilter = "SET_CODEMARK_TYPE_FILTER",
	SetChannelFilter = "SET_CHANNEL_FILTER",
	SetContext = "SET_CONTEXT",
	OpenPanel = "SET_PANEL",
	ClosePanel = "CLOSE_PANEL",
	SetFocusState = "SET_HAS_FOCUS",
	ResetContext = "RESET_CONTEXT",
	SetCurrentFile = "SET_CURRENT_FILE",
	SetCurrentTeam = "SET_CURRENT_TEAM",
	SetCurrentStream = "SET_CURRENT_STREAM"
}

export const setContext = payload => ({ type: Type.SetContext, payload });

export const openPanel = panel => (dispatch, getState) => {
	if (getState().context.panelStack[0] !== panel) {
		dispatch({ type: Type.OpenPanel, payload: panel });
		EventEmitter.emit("interaction:active-panel-changed", getState().context.panelStack);
	}
};

export const closePanel = () => (dispatch, getState) => {
	dispatch({ type: Type.ClosePanel });
	EventEmitter.emit("interaction:active-panel-changed", getState().context.panelStack);
};

export const focus = () => ({ type: Type.SetFocusState, payload: true });

export const blur = () => ({ type: Type.SetFocusState, payload: false });

export function setThread(streamId: string, threadId: string | null = null) {
	return { type: Type.SetThread, payload: { streamId, threadId } };
}

export const setCodemarkFileFilter = (value: string) => ({
	type: Type.SetCodeMarkFileFilter,
	payload: value
});

export const setCodemarkTypeFilter = (value: string) => ({
	type: Type.SetCodemarkTypeFilter,
	payload: value
});

export const setChannelFilter = (value: string) => ({
	type: Type.SetChannelFilter,
	payload: value
});
