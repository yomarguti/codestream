export const lastMessageReceived = timeToken => ({
	type: "LAST_MESSAGE_RECEIVED",
	payload: timeToken
});

export const resetMessaging = () => ({
	type: "RESET_MESSAGING"
});
