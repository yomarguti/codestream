import { setPresence } from "./actions/presence";

export default store => next => action => {
	if (
		["BOOTSTRAP_COMPLETE", "LOGGED_IN", "ONBOARDING_COMPLETE", "USER_CONFIRMED"].includes(
			action.type
		)
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
