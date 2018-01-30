import PubNubReceiver from "./pubnub-receiver";
import { fetchCurrentUser } from "./actions/user";

const _initializePubnubAndSubscribe = async (store, receiver) => {
	const { context, users, session, messaging } = store.getState();
	const user = users[session.userId];
	const teamChannels = (user.teamIds || []).map(id => `team-${id}`);

	const channels = [`user-${user.id}`, ...teamChannels];

	if (context.currentRepoId) {
		channels.push(`repo-${context.currentRepoId}`);
	}

	receiver.initialize(session.accessToken, session.userId);
	await receiver.retrieveHistory(channels, messaging);
	receiver.subscribe(channels);
}

export default store => {
	const receiver = new PubNubReceiver(store);

	return next => action => {
		const result = next(action);

		// Once data has been loaded from indexedDB, if continuing a session,
		// find current user and subscribe to team channels
		// fetch the latest version of the current user object
		if (action.type === "BOOTSTRAP_COMPLETE") {
			const { session, onboarding, users, context } = store.getState();
			if (onboarding.complete && session.accessToken) {
				store.dispatch(fetchCurrentUser());
				_initializePubnubAndSubscribe(store, receiver);
			}
		}
		// When starting a new session, subscribe to channels
		if (action.type === "LOGGED_IN" || action.type === "ONBOARDING_COMPLETE") {
			_initializePubnubAndSubscribe(store, receiver);
		}

		// When user is confirmed, subscribe to my own "me" channel
		if (action.type === "USER_CONFIRMED") {
			const { users, session } = store.getState();
			const user = users[session.userId];
			const channel = `user-${user.id}`;
			receiver.initialize(session.accessToken, user.id);
			receiver.subscribe([channel]);
		}

		// As context changes, subscribe
		if (receiver.isInitialized()) {
			if (action.type === "SET_CONTEXT" && action.payload.currentRepoId)
				receiver.subscribe([`repo-${action.payload.currentRepoId}`]);
			if (action.type === "TEAM_CREATED") receiver.subscribe([`team-${action.payload.teamId}`]);
			if (action.type === "SET_CURRENT_TEAM") receiver.subscribe([`team-${action.payload}`]);
			if (action.type === "SET_CURRENT_REPO") receiver.subscribe([`repo-${action.payload}`]);
		}

		if (action.type === "CLEAR_SESSION") {
			receiver.unsubscribeAll();
		}
		return result;
	};
};
