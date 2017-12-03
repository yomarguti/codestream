import { combineReducers } from "redux";
import onboarding from "./onboarding";

const initialState = {
	currentFile: "",
	streams: [],
	postsByStream: {},
	repo: undefined,
	repoMetadata: undefined,
	team: undefined
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

const reduceUsers = (state = [], { type, payload }) => {
	if (type === "ADD_USER") return [...state, payload];
	return state;
};

export default (state = initialState, action) => {
	if (action.type === "addDataFromOnboarding")
		return {
			...state,
			...action.payload
		};
	if (action.type === "ACTIVE_FILE_CHANGED") return { ...state, currentFile: action.payload };
	if (action.type === "ADD_REPO_INFO") return { ...state, ...action.payload };
	if (action.type === "ADD_ACCESS_TOKEN")
		return { ...state, session: { accessToken: action.payload } };
	else
		return {
			...state,
			onboarding: onboarding(state.onboarding, action),
			streams: reduceStreams(state.streams, action),
			postsByStream: reducePosts(state.postsByStream, action),
			users: reduceUsers(state.users, action)
		};
};
