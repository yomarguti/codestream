const initialState = {
	byStream: {},
	sortPerStream: {}
};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "ADD_POSTS":
		case "BOOTSTRAP_POSTS": {
			const nextState = {
				byStream: { ...state.byStream },
				sortPerStream: { ...state.sortPerStream }
			};
			payload.forEach(post => {
				const streamPosts = nextState.byStream[post.streamId] || {};
				streamPosts[post.id] = post;
				const streamOrder = nextState.sortPerStream[post.streamId] || [];
				streamOrder.push(post.id);
				nextState.byStream[post.streamId] = streamPosts;
				nextState.sortPerStream[post.streamId] = streamOrder;
			});
			return nextState;
		}
		case "ADD_POSTS_FOR_STREAM": {
			const { streamId, posts } = payload;
			const streamPosts = state.byStream[streamId] || {};
			const order = state.sortPerStream[streamId] || [];
			let shouldResort = false;
			posts.forEach(post => {
				streamPosts[post.id] = post;
				if (!order.includes(post.id)) {
					order.push(post.id);
					shouldResort = true;
				}
			});

			if (shouldResort) order.sort();

			return {
				byStream: { ...state.byStream, [streamId]: streamPosts },
				sortPerStream: { ...state.sortPerStream, [streamId]: order }
			};
		}
		case "ADD_POST":
		case "ADD_PENDING_POST": {
			const { streamId, id } = payload;
			const streamPosts = state.byStream[streamId] || {};
			streamPosts[id] = payload;
			const order = state.sortPerStream[streamId] || [];
			order.push(id);
			return {
				byStream: { ...state.byStream, [streamId]: streamPosts },
				sortPerStream: { ...state.sortPerStream, [streamId]: order }
			};
		}
		case "RESOLVE_PENDING_POST": {
			const { pendingId, post } = payload;
			const streamId = post.streamId;
			const streamPosts = state.byStream[streamId] || {};
			const nextStreamPosts = { ...streamPosts };
			delete nextStreamPosts[pendingId];
			nextStreamPosts[post.id] = post;
			const order = state.sortPerStream[streamId] || [];
			return {
				byStream: { ...state.byStream, [streamId]: nextStreamPosts },
				sortPerStream: {
					...state.sortPerStream,
					[streamId]: order.map(id => (id === pendingId ? post.id : id)).sort()
				}
			};
		}
		default:
			return state;
	}
};
