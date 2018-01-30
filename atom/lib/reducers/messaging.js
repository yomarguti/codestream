
export default (state = { }, { type, payload }) => {
	if (type === 'LAST_MESSAGE_RECEIVED') return { ...state, lastMessageReceived: payload };
	return state;
};
