import _ from "underscore-plus";

const initialState = {
	byStream: {},
	pending: []
};

const addPost = (byStream, post) => {
	const streamId = post.streamId;
	const streamPosts = byStream[streamId] || {};
	return { ...byStream, [streamId]: { ...streamPosts, [post.id]: post } };
};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "ADD_POSTS":
		case "BOOTSTRAP_POSTS": {
			const nextState = {
				...state,
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
				...state,
				byStream: { ...state.byStream, [streamId]: streamPosts }
			};
		}
		case "POSTS-HISTORY_FROM_PUBNUB":
		case "POSTS-UPDATE_FROM_PUBNUB":
		case "ADD_POST":
		case "PENDING_POST_FAILED": {
			const { streamId, id } = payload;
			const streamPosts = state.byStream[streamId] || {};
			streamPosts[id] = payload;
			return {
				...state,
				byStream: { ...state.byStream, [streamId]: streamPosts }
			};
		}
		case "ADD_PENDING_POST": {
			return { ...state, pending: [...state.pending, payload] };
		}
		case "RESOLVE_PENDING_POST": {
			const { pendingId, post } = payload;
			return {
				byStream: addPost(state.byStream, post),
				pending: state.pending.filter(post => post.id !== pendingId)
			};
		}
		default:
			return state;
	}
};

// If stream for a pending post is created, the pending post will be lost (not displayed)
// TODO: reconcile pending posts for a file with stream when it is created
export const getPostsForStream = ({ byStream, pending }, streamId = "") => {
	if (streamId === "") return [];
	const pendingForStream = pending.filter(it => {
		try {
			return it.streamId === streamId || it.stream.file === streamId;
		} catch (e) {
			return false;
		}
	});
	return [..._.sortBy(byStream[streamId], "seqNum"), ...pendingForStream];
};
