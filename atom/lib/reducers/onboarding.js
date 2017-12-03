const initialState = {
	complete: false,
	step: "signUp",
	props: {}
};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "SIGNUP_SUCCESS":
			return { ...state, step: "confirmEmail", props: payload };
		case "SIGNUP_EMAIL_EXISTS":
			return { ...state, step: "login", props: payload };
		default:
			return state;
	}
};
