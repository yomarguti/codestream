const initialState = {
	showHeadshots: true,
	reduceMotion: false
};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "UPDATE_CONFIGS":
			return { ...initialState, ...state, ...payload };
		default:
			return state;
	}
};
