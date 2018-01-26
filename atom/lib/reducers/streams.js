import { toMapBy } from "./utils";

const initialState = { byFile: {}, isFetching: false };

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "FETCH_STREAM":
			return { ...state, isFetching: true };
		case "RECEIVE_STREAM":
			return { ...state, isFetching: false };
		case "ADD_STREAMS":
		case "BOOTSTRAP_STREAMS":
			return { ...state, byFile: { ...state.byFile, ...toMapBy("file", payload) } };
		case "STREAMS-UPDATE_FROM_PUBNUB":
		case "ADD_STREAM":
			return {
				...state,
				byFile: { ...state.byFile, [payload.file]: payload }
			};
		default:
			return state;
	}
};
