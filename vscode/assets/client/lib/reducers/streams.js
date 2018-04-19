import { toMapBy } from "./utils";

const initialState = {
	// [id]: stream
};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "ADD_STREAMS":
		case "BOOTSTRAP_STREAMS":
			return { ...state, ...toMapBy('id', payload) };
		case "STREAMS-UPDATE_FROM_PUBNUB":
		case "ADD_STREAM":
			return { ...state, [payload.id]: payload };
		default:
			return state;
	}
};
