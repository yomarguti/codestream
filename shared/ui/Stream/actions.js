// uuid generator taken from: https://gist.github.com/jed/982883
const createTempId = a =>
	a
		? (a ^ ((Math.random() * 16) >> (a / 4))).toString(16)
		: ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, createTempId);

export const markStreamRead = streamId => (dispatch, getState, { api }) => {
	if (!streamId) return;
	api.markStreamRead(streamId);
	return dispatch({ type: "CLEAR_UMI", payload: streamId });
};

export const createPost = (streamId, parentPostId, text, codeBlocks, mentions, extra) => async (
	dispatch,
	getState,
	{ api }
) => {
	const { context, session } = getState();
	const pendingId = createTempId();
	dispatch({
		type: "ADD_PENDING_POST",
		payload: {
			id: pendingId,
			streamId,
			parentPostId,
			codeBlocks,
			text,
			commitHashWhenPosted: context.currentCommit,
			creatorId: session.userId,
			pending: true
		}
	});
	try {
		const post = await api.createPost({
			id: pendingId,
			parentPostId,
			streamId,
			text,
			codeBlocks,
			mentions,
			extra
		});
		// FIXME: this is for analytics purposes and the extension host should probably send the event
		dispatch({ type: "POST_CREATED", meta: { post, ...extra } });
		return dispatch({
			type: "RESOLVE_PENDING_POST",
			payload: { pendingId, post }
		});
	} catch (e) {
		return dispatch({ type: "PENDING_POST_FAILED", payload: pendingId });
	}
};

export const createSystemPost = () => {
	// TODO
};

export const editPost = () => {
	// TODO
};

export const deletePost = () => {
	// TODO
};

export const setUserPreference = () => {
	// TODO
};

export const createStream = () => {
	// TODO
};
