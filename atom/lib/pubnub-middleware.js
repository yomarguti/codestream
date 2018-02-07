import PubNubReceiver from "./pubnub-receiver";
import { fetchCurrentUser } from "./actions/user";
import { subscriptionFailure } from "./actions/messaging";

let lastTick = null;
let ticksInitiated = false;
const _initiateTicks = (store, receiver) => {
	// start a ticking clock, look for anything that misses a tick by more than a whole second
	setInterval(() => {
		const now = Date.now();
		if (lastTick && now - lastTick > 3000) {
			// we'll assume this is a laptop sleep event or something that otherwise
			// stopped execution for longer than expected ... we'll make sure we're
			// subscribed to the channels we need to be and fetch history to catch up,
			// in case we missed any messages
			// console.debug("WAKING FROM SLEEP");
			receiver.unsubscribeAll();
			_initializePubnubAndSubscribe(store, receiver);
		}
		lastTick = now;
	}, 1000);
	ticksInitiated = true;
};

const _initializePubnubAndSubscribe = async (store, receiver) => {
	const { context, users, session, messaging } = store.getState();
	const user = users[session.userId];
	const teamChannels = (user.teamIds || []).map(id => `team-${id}`);

	const channels = [`user-${user.id}`, ...teamChannels];

	if (context.currentRepoId) {
		channels.push(`repo-${context.currentRepoId}`);
	}

	store.dispatch({ type: "CATCHING_UP" });

	receiver.initialize(session.accessToken, session.userId, session.sessionId);
	receiver.subscribe(channels);
	if (!ticksInitiated) {
		_initiateTicks(store, receiver);
	}
	return receiver.retrieveHistory(channels, messaging);
};

export default store => {
	const receiver = new PubNubReceiver(store);

	return next => action => {
		const result = next(action);

		// Once data has been loaded from indexedDB, if continuing a session,
		// find current user and subscribe to channels
		// fetch the latest version of the current user object
		if (action.type === "BOOTSTRAP_COMPLETE") {
			const { session, onboarding } = store.getState();
			if (onboarding.complete && session.accessToken) {
				store.dispatch(fetchCurrentUser());
				_initializePubnubAndSubscribe(store, receiver);
			}
		}
		// When starting a new session, subscribe to channels
		if (
			action.type === "LOGGED_IN" ||
			action.type === "ONBOARDING_COMPLETE" ||
			action.type === "USER_CONFIRMED" ||
			action.type === "EXISTING_USER_LOGGED_INTO_NEW_REPO" ||
			action.type === "NEW_USER_LOGGED_INTO_NEW_REPO"
		) {
			_initializePubnubAndSubscribe(store, receiver);
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

		// if we come online after a period of being offline, retrieve message history
		if (action.type === "ONLINE") {
			const { messaging } = store.getState();
			receiver.retrieveHistory(null, messaging);
		}

		return result;
	};
};
