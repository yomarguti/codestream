const initialState = {
	byStream: {}
};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "ADD_POSTS":
		case "BOOTSTRAP_POSTS": {
			const nextState = {
				byStream: { ...state.byStream }
			};
			payload.forEach(post => {
				const streamPosts = nextState.byStream[post.streamId] || {};
				streamPosts[post.id] = post;
				nextState.byStream[post.streamId] = streamPosts;
			});
			return nextState;
		}
		case "ADD_POSTS_FOR_STREAM": {
			const { streamId, posts } = payload;
			const streamPosts = state.byStream[streamId] || {};
			posts.forEach(post => {
				streamPosts[post.id] = post;
			});

			return {
				byStream: { ...state.byStream, [streamId]: streamPosts }
			};
		}
		case "ADD_POST":
		case "ADD_PENDING_POST": {
			const { streamId, id } = payload;
			const streamPosts = state.byStream[streamId] || {};
			streamPosts[id] = payload;
			return {
				byStream: { ...state.byStream, [streamId]: streamPosts }
			};
		}
		case "RESOLVE_PENDING_POST": {
			const { pendingId, post } = payload;
			const streamId = post.streamId;
			const streamPosts = state.byStream[streamId] || {};
			const nextStreamPosts = { ...streamPosts };
			delete nextStreamPosts[pendingId];
			nextStreamPosts[post.id] = post;
			return {
				byStream: { ...state.byStream, [streamId]: nextStreamPosts }
			};
		}
		default:
			return state;
	}
};
