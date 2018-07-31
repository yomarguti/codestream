export default store => {
	return next => action => {
		console.groupCollapsed(action.type);
		console.debug(action)
		console.debug('current state', store.getState())
		const result  = next(action)
		console.debug('new state', store.getState())
		console.groupEnd()
		return result
	};
};
