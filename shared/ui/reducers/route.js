export default (state = "login", { type, payload }) => {
	switch (type) {
		case "GO_TO_COMPLETE_SIGNUP":
			return "completeSignup";
		case "GO_TO_LOGIN":
			return "login";
		default:
			return state;
	}
};
