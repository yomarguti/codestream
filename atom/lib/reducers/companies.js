import { toMapBy } from "./utils";

const initialState = {};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "BOOTSTRAP_COMPANIES":
			return toMapBy("id", payload);
		default:
			return state;
	}
};
