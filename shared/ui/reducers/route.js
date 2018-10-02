export default (state = "signup", { type }) => {
	switch (type) {
		case "GO_TO_COMPLETE_SIGNUP":
			return "completeSignup";
		case "GO_TO_LOGIN":
			return "login";
		default:
			return state;
	}
};
