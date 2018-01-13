import { toMapBy } from "./utils";

const initialState = {};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "INCREMENT_UMI": {
			console.log("incrementint umis in the reducer: ", payload);
			if (!state.unread) state.unread = {};
			state.unread[payload] = (state.unread[payload] || 0) + 1;
			console.log("STATE IS: ", state);
			return state;
		}
		case "INCREMENT_MENTION": {
			console.log("incrementing mention in the reducer: ", payload);
			// payload is a streamId
			if (!state.mentions) state.mentions = {};
			if (!state.unread) state.unread = {};
			state.mentions[payload] = (state.mentions[payload] || 0) + 1;
			state.unread[payload] = (state.unread[payload] || 0) + 1;
			return state;
		}
		case "CLEAR_UMI": {
			console.log("clear umis in the reducer: ", payload);
			// instead of deleting it, we set it to zero
			// so that when we loop through the keys we can
			// still reference the fact that this div needs to be cleared
			if (!state.mentions) state.mentions = {};
			if (!state.unread) state.unread = {};
			if (state.mentions[payload]) state.mentions[payload] = 0;
			if (state.unread[payload]) state.unread[payload] = 0;
			// delete state[payload];
			return state;
		}
		case "RECALCULATE_UMI": {
			state.mentions = {};
			state.unread = {};
			console.log(payload);
			// FIXME loop through each stream and recalculate
			return state;
		}
		default:
			return state;
	}
	return state;
};
