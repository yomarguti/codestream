const initialState = {
	complete: false,
	requestInProcess: false,
	step: "signUp",
	props: {},
	errors: {}
};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "REQUEST_STARTED":
			return { ...state, requestInProcess: true };
		case "REQUEST_FINISHED":
			return { ...state, requestInProcess: false };
		case "SIGNUP_SUCCESS":
			return { ...state, step: "confirmEmail", props: payload };
		case "SIGNUP_EMAIL_EXISTS":
			return { ...state, step: "login", props: payload };
		case "GO_TO_SIGNUP":
			return { ...state, step: "signUp" };
		case "NEW_USER_CONFIRMED_IN_NEW_REPO":
			return { ...state, step: "createTeam" };
		case "EXISTING_USER_CONFIRMED_IN_NEW_REPO":
			return { ...state, step: "selectTeam" };
		case "EXISTING_USER_CONFIRMED":
			return { ...initialState, complete: true };
		case "INVALID_CONFIRMATION_CODE":
			return { ...state, errors: { invalidCode: true } };
		case "EXPIRED_CONFIRMATION_CODE":
			return { ...state, errors: { expiredCode: true } };
		default:
			return state;
	}
};
