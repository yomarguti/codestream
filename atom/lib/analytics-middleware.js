import mixpanel from "mixpanel-browser";

mixpanel.init("4308967c7435e61d9697ce240bc68d02");

export default store => next => action => {
	const result = next(action);

	if (action.type === "SIGNUP_SUCCESS") {
		const user = action.meta;
		mixpanel.alias(user.id);
		mixpanel.register_once({
			"Date Signed Up": new Date(user.createdAt).toISOString() // should actually be based on user.registeredAt
		});
		mixpanel.register({
			"Email Address": user.email,
			Endpoint: "Atom",
			"First Time User?": false, // might need to move this to after the very first event is tracked
			Plan: "Free"
		});
		mixpanel.track("Sign Up Success");
	}
	if (action.type === "LOGGED_IN") {
		mixpanel.identify(store.getState().session.userId);
	}

	if (action.type.includes("USERNAME_COLLISION")) {
		mixpanel.track("Username Collision");
	}
	return result;
};
