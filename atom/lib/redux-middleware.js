import { incrementUMI } from "./actions/user";

export default store => next => action => {
	console.log("In MW");
	const { context } = store.getState();
	if (action.type === "POSTS-UPDATE_FROM_PUBNUB") {
		// If post is not in currently visible stream i.e `action.payload.streamId !== streams.byFile[context.currentFile].id`
		// and action.payload.creatorId !== session.userId
		console.log("In MW 2", action.payload);

		store.dispatch(incrementUMI(action.payload.streamId));
	}
	return next(action);
};
