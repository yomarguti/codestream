import mixpanel from "mixpanel-browser";

mixpanel.init("4308967c7435e61d9697ce240bc68d02");

export default store => next => action => {
	const result = next(action);

	if (action.type === "SIGNUP_SUCCESS") {
		mixpanel.alias(action.userId);
	}
	if (action.type === "LOGGED_IN") {
		mixpanel.identify(store.getState().session.userId);
	}
	return result;
};
