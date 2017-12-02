const initialState = {
	currentFile: "",
	streams: [],
	postsByStream: {}
};

const reduceStreams = (state = [], action) => {
	switch (action.type) {
		case "ADD_STREAM":
			return [...state, action.payload];
		default:
			return state;
	}
};

const reducePosts = (state = {}, { type, payload }) => {
	switch (type) {
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

export default (state = initialState, action) => {
	if (action.type === "addDataFromOnboarding")
		return {
			...state,
			...action.payload
		};
	if (action.type === "ACTIVE_FILE_CHANGED") return { ...state, currentFile: action.payload };
	else
		return {
			...state,
			streams: reduceStreams(state.streams, action),
			postsByStream: reducePosts(state.postsByStream, action)
		};
};
