import mixpanel from "mixpanel-browser";

mixpanel.init("4308967c7435e61d9697ce240bc68d02");

export default store => next => action => {
	const result = next(action);

	// Once data has been loaded from indexedDB, if continuing a session,
	if (action.type === "BOOTSTRAP_COMPLETE") {
		const { session, onboarding } = store.getState();
		if (onboarding.complete && session.accessToken) {
			mixpanel.identify(session.userId);
		}
	}

	if (action.type === "SIGNUP_SUCCESS") {
		const user = action.meta;
		mixpanel.alias(user.id);
		mixpanel.register_once({
			"Date Signed Up": new Date(user.createdAt).toISOString() // should actually be based on user.registeredAt
		});
		mixpanel.register({
			"Email Address": user.email,
			Endpoint: "Atom",
			// "First Time User?": false, // might need to move this to after the very first event is tracked
			Plan: "Free"
		});
		mixpanel.track("Sign Up Success");
	}

	if (action.type === "USER_CONFIRMED")
		mixpanel.track("Email Confirmed", {
			"SignUp Type": action.meta.alreadyOnTeam ? "Viral" : "Organic"
		});

	if (action.type === "LOGGED_IN") {
		mixpanel.identify(store.getState().session.userId);
	}

	if (action.type.includes("USERNAME_COLLISION")) {
		mixpanel.track("Username Collision");
	}

	if (action.type === "POST_CREATED") {
		const { post, ...extra } = action.meta;
		const currentUser = store.getState().users[post.creatorId];

		let type;
		if (post.codeBlocks.length === 0) type = "Chat";
		else type = post.codeBlocks[0].code.length > 0 ? "Code Quote" : "Code Location";

		mixpanel.track("Post Created", {
			Endpoint: "Atom",
			Thread: post.parentPostId ? "Reply" : "Parent",
			Category: "Source File",
			"Auto Mentions": extra.autoMentions.some(mention => post.text.includes(mention)),
			"First Post?": Boolean(currentUser.totalPosts) === false,
			Type: type
		});
	}
	return result;
};
