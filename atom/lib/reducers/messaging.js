const initialState = { catchingUp: false };

export default (state = initialState, { type, payload }) => {
	if (type === "RESET_MESSAGING") return initialState;
	if (type === "LAST_MESSAGE_RECEIVED") return { ...state, lastMessageReceived: payload };
	if (type === "CAUGHT_UP") return { ...state, catchingUp: false };
	if (type === "CATCHING_UP") return { ...state, catchingUp: true };
	return state;
};
