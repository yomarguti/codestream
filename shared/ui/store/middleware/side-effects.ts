export const sideEffects = store => next => action => {
	return next(action);
};
