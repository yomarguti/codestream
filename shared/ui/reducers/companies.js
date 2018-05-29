import { toMapBy } from "./utils";

const initialState = {};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "BOOTSTRAP_COMPANIES":
			return toMapBy("id", payload);
		case "COMPANIES-UPDATE_FROM_PUBNUB":
		case "ADD_COMPANY":
			return { ...state, [payload.id]: payload };
		case "ADD_COMPANIES":
			return { ...state, ...toMapBy("id", payload) };
		default:
			return state;
	}
};
