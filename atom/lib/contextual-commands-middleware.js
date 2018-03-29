import { CompositeDisposable } from "atom";
import { showSlackInfo } from "./actions/context";
import { goToInvitePage } from "./actions/routing";

export default store => {
	const subscriptions = new CompositeDisposable();

	const registerCommands = () => {
		subscriptions.add(
			atom.commands.add("atom-workspace", {
				"codestream:slack-integration": () => store.dispatch(showSlackInfo())
			}),
			atom.commands.add("atom-workspace", {
				"codestream:invite": () => store.dispatch(goToInvitePage())
			})
		);
	};

	return next => action => {
		const result = next(action);

		if (action.type === "BOOTSTRAP_COMPLETE") {
			const { session, onboarding } = store.getState();
			if (onboarding.complete && session.accessToken) {
				registerCommands();
			}
		}

		// When starting a new session, subscribe to channels
		if (action.type === "LOGGED_IN" || action.type === "ONBOARDING_COMPLETE") {
			registerCommands();
		}

		if (action.type === "CLEAR_SESSION") subscriptions.dispose();

		return result;
	};
};
