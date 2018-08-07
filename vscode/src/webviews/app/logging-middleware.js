export default store => {
	return next => action => {
		const oldState = Object.assign({}, store.getState());
		const result = next(action);

		console.groupCollapsed(action.type);
		console.debug(action);
		console.debug("old state", oldState);
		console.debug("new state", Object.assign({}, store.getState()));
		console.groupEnd();

		return result;
	};
};
