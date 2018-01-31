
export default (state = { }, { type, payload }) => {
	if (type === 'RESET_MESSAGING') return { };
	if (type === 'LAST_MESSAGE_RECEIVED') return { ...state, lastMessageReceived: payload };
	return state;
};
