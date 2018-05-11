import { CompositeDisposable } from "atom";
import { logout, showSlackInfo } from "./actions/context";
import { goToInvitePage } from "./actions/routing";
import AddCommentPopupManager from "./workspace/add-comment-popup-manager";
import BufferChangeTracker from "./workspace/buffer-change-tracker";

class CodeStreamSession {
	popupManager = null;

	constructor(store) {
		this.store = store;
	}

	initialize() {
		const { repoAttributes } = this.store.getState();
		this.popupManager = new AddCommentPopupManager(repoAttributes.workingDirectory);
		this.bufferChangeTracker = new BufferChangeTracker(this.store, repoAttributes.workingDirectory);
	}

	destroy() {
		this.popupManager.destroy();
	}
}

export default store => {
	const subscriptions = new CompositeDisposable();
	const csSession = new CodeStreamSession(store);

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
				csSession.initialize();
				registerCommands();
			}
		}

		// When starting a new session, subscribe to channels
		if (action.type === "LOGGED_IN" || action.type === "ONBOARDING_COMPLETE") {
			csSession.initialize();
			registerCommands();
		}

		if (action.type === "CLEAR_SESSION") {
			subscriptions.dispose();
			csSession.destroy();
		}

		return result;
	};
};
