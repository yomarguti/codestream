import _ from "underscore";

interface Post {
	id: string;
}

interface Index {
	[id: string]: Post;
}

interface State {
	byStream: {
		[streamId: string]: Index;
	};
	pending: Post[];
}

const initialState = {
	byStream: {},
	pending: []
};

const addPost = (byStream, post) => {
	const streamId = post.streamId;
	const streamPosts = byStream[streamId] || {};
	return { ...byStream, [streamId]: { ...streamPosts, [post.id]: post } };
};

export default (state: State = initialState, { type, payload }) => {
	switch (type) {
		case "BOOTSTRAP_POSTS": {
			const nextState = {
				pending: [...state.pending],
				byStream: { ...state.byStream }
			};
			payload.forEach(post => {
				if (post.pending) nextState.pending.push(post);
				else {
					nextState.byStream = addPost(nextState.byStream, post);
				}
			});
			return nextState;
		}
		case "ADD_POSTS_FOR_STREAM": {
			const { streamId, posts } = payload;
			const streamPosts = { ...(state.byStream[streamId] || {}) };
			posts.filter(Boolean).forEach(post => {
				streamPosts[post.id] = post;
			});

			return {
				...state,
				byStream: { ...state.byStream, [streamId]: streamPosts }
			};
		}
		case "UPDATE_POST":
		case "ADD_POST":
			return {
				...state,
				byStream: addPost(state.byStream, payload)
			};
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
		case "PENDING_POST_FAILED": {
			return {
				...state,
				pending: state.pending.map(post => {
					return post.id === payload ? { ...post, error: true } : post;
				})
			};
		}
		case "CANCEL_PENDING_POST": {
			return {
				...state,
				pending: state.pending.filter(post => post.id !== payload)
			};
		}
		case "DELETE_POST": {
			const { id, streamId } = payload;
			const streamPosts = { ...(state.byStream[streamId] || {}) };
			delete streamPosts[id];

			return {
				...state,
				byStream: { ...state.byStream, [streamId]: streamPosts }
			};
		}
		default:
			return state;
	}
};

export const getPostsForStream = ({ byStream, pending }, streamId) => {
	if (!streamId) return [];
	const pendingForStream = pending.filter(it => {
		try {
			return it.streamId === streamId || it.stream.file === streamId;
		} catch (e) {
			return false;
		}
	});
	return [
		..._.sortBy(byStream[streamId], "seqNum").filter(p => !p.deactivated),
		...pendingForStream
	];
};

export const getPost = ({ byStream, pending }, streamId, postId) => {
	const post = (byStream[streamId] || {})[postId];
	return post || pending.find(p => p.id === postId);
};
