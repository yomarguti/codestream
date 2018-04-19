let OnlinePollTimer;

export const offline = () => ({ type: "OFFLINE" });
export const online = () => {
	if (OnlinePollTimer) {
		clearTimeout(OnlinePollTimer);
		OnlinePollTimer = null;
	}
	return { type: "ONLINE" };
};

export const checkServerStatus = () => async (dispatch, getState, { http }) => {
	try {
		await http.get("/no-auth/status");
		return dispatch(online());
	} catch (error) {
		return false;
	}
};

export const pollTillOnline = () => {
	if (OnlinePollTimer) {
		return;
	}
	OnlinePollTimer = setTimeout(() => {
		if (navigator.onLine) {
			OnlinePollTimer = null;
			checkServerStatus();
		} else {
			OnlinePollTimer = pollTillOnline();
		}
	}, 500);
};
