export default (state = null, { type, payload }) => {
	switch (type) {
		case "GO_TO_INVITE_PAGE":
			return "invite";
		case "EXIT_INVITE_PAGE":
			return null;
		default:
			return state;
	}
};
