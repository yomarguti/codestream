export default store => {
	window.addEventListener(
		"message",
		event => {
			console.log("received message from extension host", event.data);
			const { type, body } = event.data;
			if (type === "push-data") {
				return store.dispatch({ type: `ADD_${body.type.toUpperCase()}`, payload: body.payload });
			}
			if (type === "ui-data") {
				return store.dispatch(body);
			}
		},
		false
	);

	return next => action => {
		console.debug(`new action: ${action.type}`, action.payload);
		const result  = next(action)
		console.debug('new state is', store.getState())
		return result
	};
};
