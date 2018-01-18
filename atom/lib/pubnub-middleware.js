import PubNubReceiver from "./pubnub-receiver";
import { fetchCurrentUser } from "./actions/user";

export default store => {
	const receiver = new PubNubReceiver(store);

	return next => action => {
		const result = next(action);

		// Once users have been loaded from indexedDB, if continuing a session,
		// find current user and subscribe to team channels
		// fetch the latest version of the current user object
		if (action.type === "BOOTSTRAP_COMPLETE") {
			const { session, onboarding, users, context } = store.getState();
			if (onboarding.complete && session.accessToken) {
				store.dispatch(fetchCurrentUser());

				const user = users[session.userId];
				const teamChannels = (user.teamIds || []).map(id => `team-${id}`);

				const channels = [`user-${user.id}`, ...teamChannels];

				if (context.currentRepoId) channels.push(`repo-${context.currentRepoId}`);

				receiver.initialize(session.accessToken, session.userId);
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

			receiver.initialize(action.payload.accessToken, user.id);
			receiver.subscribe(channels);
		}
		// As context changes, subscribe
		if (action.type === "SET_CONTEXT" && action.payload.currentRepoId) {
			if (receiver.isInitialized()) receiver.subscribe([`repo-${action.payload.currentRepoId}`]);
		}

		if (action.type === "TEAM_CREATED") receiver.subscribe([`team-${action.payload.teamId}`]);
		if (action.type === "SET_CURRENT_TEAM") receiver.subscribe([`team-${action.payload}`]);
		if (action.type === "SET_CURRENT_REPO") receiver.subscribe([`repo-${action.payload}`]);

		return result;
	};
};
