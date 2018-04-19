// internal globals
let PresenceTimer;
let AwayTimeout;
let AwayTimer;
let Presence;

// set the presence status for this session as online, away, or offline
// the server sends us an awayTimeout value, which tells us how long to wait
// when there is no user activity before we call the user "away"
export const setPresence = status => async (dispatch, getState, { http }) => {
	const { session } = getState();
	const { sessionId, accessToken } = session;
	if (!sessionId || !accessToken) return;

	// tell the api server about our status, we get back the away timeout value
	Presence = status;
	const presenceResponse = await http.put(
		"/presence",
		{
			sessionId,
			status
		},
		accessToken
	);
	AwayTimeout = presenceResponse.awayTimeout;

	// if we are online, let the server know before the away timeout can expire
	// (so use 90% of the away timeout) ... if we stop sending these updates, the
	// server will mark our status as "stale" and consider the session no longer online
	if (PresenceTimer) {
		clearTimeout(PresenceTimer);
	}
	if (status === "online") {
		const interval = Math.floor(AwayTimeout * 9 / 10);
		PresenceTimer = setTimeout(() => {
			dispatch(setPresence("online"));
		}, interval);
	}
};

// the away timeout has expired, set our presence status as "away"
function setAway(dispatch) {
	if (PresenceTimer) {
		// end the regular "online" updates to the server
		clearTimeout(PresenceTimer);
	}
	dispatch(setPresence("away"));
}

// the user has performed some activity, set presence as "online" and initiate
// the "away" timer again ... when the away timer expires with no activity,
// our presence is "away"
export const setActive = () => (dispatch, getState, { http }) => {
	if (Presence !== "online") {
		dispatch(setPresence("online"));
	}
	if (AwayTimeout) {
		if (AwayTimer) {
			clearTimeout(AwayTimer);
		}
		AwayTimer = setTimeout(setAway, AwayTimeout, dispatch);
	}
};
