import { toMapBy } from "./utils";

const initialState = {};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "INCREMENT_UMI": {
			// payload contains the stream ID and the post ID
			// if the post is NOT visible (either different stream id
			// or we have scrolled up) then do not change UMI... otherwise
			console.log("incrementint umis in the reducer: ", payload);
			let streamId = payload;
			return { ...state, [streamId]: (state[streamId] || 0) + 1 };
		}
		case "CLEAR_UMI": {
			console.log("clear umis in the reducer: ", payload);
			// instead of deleting it, we set it to zero
			// so that when we loop through the keys we can
			// still reference the fact that this div needs to be cleared
			if (state[payload]) state[payload] = 0;
			// delete state[payload];
			return state;
		}
		case "RECALCULATE_UMI": {
			// loop through each stream and recalculate
		}
		default:
			return state;
	}
	return state;
};
