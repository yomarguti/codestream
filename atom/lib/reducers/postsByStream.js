export default (state = {}, { type, payload }) => {
	switch (type) {
		case "BOOTSTRAP_POSTS": {
			const nextState = {};
			payload.forEach(post => {
				const existingPosts = nextState[post.streamId] || [];
				nextState[post.streamId] = [...existingPosts, post];
			});
			return nextState;
		}
		case "ADD_POSTS_FOR_STREAM": {
			const { streamId, posts } = payload;
			const existingPosts = state[streamId] || [];
			return { ...state, [streamId]: [...existingPosts, ...posts] };
		}
		case "ADD_PENDING_POST": {
			const { streamId } = payload;
			const existingPosts = state[streamId] || [];
			return { ...state, [streamId]: [...existingPosts, payload] };
		}
		case "RESOLVE_PENDING_POST": {
			const { pendingId, post } = payload;
			const posts = (state[post.streamId] || []).map(it => (it.id === pendingId ? post : it));
			return { ...state, [post.streamId]: posts };
		}
		default:
			return state;
	}
};
