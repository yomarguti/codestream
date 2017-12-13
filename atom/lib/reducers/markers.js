import { toMapBy } from "./utils";

const initialState = {};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "BOOTSTRAP_MARKERS":
			return toMapBy("id", payload);
		case "ADD_MARKERS":
			return { ...state, ...toMapBy("id", payload) };
		default:
			return state;
	}
};
