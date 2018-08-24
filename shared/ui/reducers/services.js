const initialState = {};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "BOOTSTRAP_SERVICES":
			return { ...payload, ...state };
		default:
			return { ...initialState, ...state };
	}
};
