import PubNubReceiver from "./pubnub-receiver";

export default store => {
	const receiver = new PubNubReceiver(store);

	return next => action => {
		const result = next(action);

		// Once users have been loaded from indexedDB, if continuing a session,
		// find current user and subscribe to team channels
		if (action.type === "BOOTSTRAP_COMPLETE") {
			const { session, onboarding, users, context } = store.getState();
			if (onboarding.complete && session.accessToken) {
				const user = users[session.userId];
				const teamChannels = (user.teamIds || []).map(id => `team-${id}`);

				const channels = [`user-${user.id}`, ...teamChannels];

				if (context.currentRepoId) channels.push(`repo-${context.currentRepoId}`);

				receiver.initialize(session.accessToken);
				receiver.subscribe(channels);
			}
		}
		// When starting a new session, subscribe to channels
		if (action.type === "INIT_SESSION") {
			const { user } = action.meta;
			const teamChannels = (user.teamIds || []).map(id => `team-${id}`);

			const channels = [`user-${user.id}`, ...teamChannels];

			const repoId = store.getState().context.currentRepoId;
			if (repoId) channels.push(`repo-${repoId}`);

			receiver.initialize(action.payload.accessToken);
			receiver.subscribe(channels);
		}
		// As context changes, subscribe
		if (action.type === "SET_CONTEXT" && action.payload.currentRepoId) {
			if (receiver.isInitialized()) receiver.subscribe([`repo-${action.payload.currentRepoId}`]);
		}

		return result;
	};
};
