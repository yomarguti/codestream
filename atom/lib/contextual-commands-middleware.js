import { showSlackInfo } from "./actions/context";

let disposable;

export default store => {
	const registerCommand = () => {
		disposable = atom.commands.add("atom-workspace", {
			"codestream:slack-integration": () => store.dispatch(showSlackInfo())
		});
	};

	return next => action => {
		const result = next(action);

		if (action.type === "BOOTSTRAP_COMPLETE") {
			const { session, onboarding } = store.getState();
			if (onboarding.complete && session.accessToken) {
				registerCommand();
			}
		}

		// When starting a new session, subscribe to channels
		if (action.type === "LOGGED_IN" || action.type === "ONBOARDING_COMPLETE") {
			registerCommand();
		}

		if (action.type === "CLEAR_SESSION") disposable && disposable.dispose();

		return result;
	};
};
