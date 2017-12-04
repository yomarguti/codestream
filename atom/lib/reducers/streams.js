import { toMapBy } from "./utils";

const initialState = { byFile: {}, byId: {} };

export default (state = initialState, { type, payload }) => {
	if (type === "BOOTSTRAP_STREAMS")
		return { byFile: toMapBy("file", payload), byId: toMapBy("id", payload) };
	else if (type === "ADD_STREAM")
		return {
			byFile: { ...state.byFile, [payload.file]: payload },
			byId: { ...state.byId, [payload.id]: payload }
		};
	return state;
};
