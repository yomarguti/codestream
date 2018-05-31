import { CompositeDisposable } from "atom";
import { logout, showSlackInfo } from "./actions/context";
import { goToInvitePage } from "./actions/routing";
import WorkspaceApi from "./workspace/workspace-api";

export default store => {
	const subscriptions = new CompositeDisposable();
	const workspace = new WorkspaceApi(store);

	const registerCommands = () => {
		subscriptions.add(
			atom.commands.add("atom-workspace", {
				"codestream:slack-integration": () => store.dispatch(showSlackInfo()),
				"codestream:invite": () => store.dispatch(goToInvitePage()),
				"codestream:logout": () => store.dispatch(logout())
			})
		);
	};

	return next => action => {
		const result = next(action);

		if (action.type === "BOOTSTRAP_COMPLETE") {
			const { session, onboarding } = store.getState();
			if (onboarding.complete && session.accessToken) {
				workspace.initialize();
				registerCommands();
			}
		}

		// When starting a new session, subscribe to channels
		if (action.type === "LOGGED_IN" || action.type === "ONBOARDING_COMPLETE") {
			workspace.initialize();
			registerCommands();
		}

		if (action.type === "CLEAR_SESSION") {
			subscriptions.dispose();
			workspace.destroy();
		}

		return result;
	};
};
