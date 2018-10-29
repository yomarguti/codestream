export const setContext = payload => ({ type: "SET_CONTEXT", payload });

export const setPanel = panel => (dispatch, getState) => {
	if (getState().context.panel !== panel) dispatch({ type: "SET_PANEL", payload: panel });
};

export const closePanel = () => dispatch => {
	dispatch({ type: "CLOSE_PANEL", payload: panel });
};

export const focus = () => ({ type: "SET_HAS_FOCUS", payload: true });

export const blur = () => ({ type: "SET_HAS_FOCUS", payload: false });
