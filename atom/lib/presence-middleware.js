import { setPresence } from "./actions/presence";

export default store => next => action => {
	if (
		[
			"BOOTSTRAP_COMPLETE",
			"LOGGED_IN",
			"ONBOARDING_COMPLETE",
			"USER_CONFIRMED",
			"NEW_USER_LOGGED_INTO_NEW_REPO",
			"NEW_USER_CONFIRMED_IN_NEW_REPO",
			"EXISTING_USER_LOGGED_INTO_NEW_REPO"
		].includes(action.type)
	) {
		// after initialization with a valid access token, start dealing with
		// presence, which tracks whether we are active in the session, or "away"
		const { session } = store.getState();
		if (session.accessToken) {
			store.dispatch(setPresence("online"));
		}
	}

	return next(action);
};
