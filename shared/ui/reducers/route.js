const initialState = {
	route: "signup",
	params: {}
};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "GO_TO_COMPLETE_SIGNUP":
			return { ...state, route: "completeSignup", params: payload };
		case "GO_TO_LOGIN":
			return { ...state, route: "login", params: payload };
		default:
			return state;
	}
};
