import { toMapBy } from "./utils";

const initialState = { byFile: {}, isFetching: false };

export default (state = initialState, { type, payload }) => {
	if (type === "FETCH_STREAM") return { ...state, isFetching: true };
	if (type === "RECEIVE_STREAM") return { ...state, isFetching: false };
	if (type === "BOOTSTRAP_STREAMS") return { ...state, byFile: toMapBy("file", payload) };
	else if (type === "ADD_STREAM")
		return {
			byFile: { ...state.byFile, [payload.file]: payload }
		};
	return state;
};
