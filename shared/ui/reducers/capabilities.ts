const initialState = {};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "UPDATE_CAPABILITIES":
			return { ...state, ...payload };
		default:
			return state;
	}
};
