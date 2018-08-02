export default (state = "login", { type, payload }) => {
	switch (type) {
		case "GO_TO_COMPLETE_SIGNUP":
			return "completeSignup";
		default:
			return state;
	}
};
