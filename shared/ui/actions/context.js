export const setContext = payload => ({ type: "SET_CONTEXT", payload });
export const setPanel = panel => (dispatch, getState) => {
	if (getState().context.panel !== panel) dispatch({ type: "SET_PANEL", payload: panel });
};
