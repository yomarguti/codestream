export enum Type {
	SetThread = "SET_CURRENT_THREAD",
	SetCodeMarkFileFilter = "SET_CODEMARK_FILE_FILTER",
	SetCodemarkTypeFilter = "SET_CODEMARK_TYPE_FILTER",
	SetChannelFilter = "SET_CHANNEL_FILTER"
}

export const setContext = payload => ({ type: "SET_CONTEXT", payload });

export const openPanel = panel => (dispatch, getState) => {
	if (getState().context.panelStack[0] !== panel) dispatch({ type: "SET_PANEL", payload: panel });
};

export const closePanel = () => dispatch => {
	dispatch({ type: "CLOSE_PANEL" });
};

export const focus = () => ({ type: "SET_HAS_FOCUS", payload: true });

export const blur = () => ({ type: "SET_HAS_FOCUS", payload: false });

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
