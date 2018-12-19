import _ from "underscore";
import { CSPost } from "../../shared/api.protocol";
import { ActionType } from "../common";
import * as actions from "./actions";
import { isPending, PostsActionsType, State } from "./types";

type PostsActions = ActionType<typeof actions>;

const initialState = {
	byStream: {},
	pending: []
};

const addPost = (byStream, post: CSPost) => {
	const streamId = post.streamId;
	const streamPosts = byStream[streamId] || {};
	return { ...byStream, [streamId]: { ...streamPosts, [post.id]: post } };
};

export function reducePosts(state: State = initialState, action: PostsActions) {
	switch (action.type) {
		case PostsActionsType.Add:
		case PostsActionsType.Bootstrap: {
			const nextState = {
				pending: [...state.pending],
				byStream: { ...state.byStream }
			};
			action.payload.forEach(post => {
				if (isPending(post)) nextState.pending.push(post);
				else {
					nextState.byStream = addPost(nextState.byStream, post);
				}
			});
			return nextState;
		}
		case PostsActionsType.AddForStream: {
			const { streamId, posts } = action.payload;
			const streamPosts = { ...(state.byStream[streamId] || {}) };
			posts.filter(Boolean).forEach(post => {
				streamPosts[post.id] = post;
			});

			return {
				...state,
				byStream: { ...state.byStream, [streamId]: streamPosts }
			};
		}
		case PostsActionsType.Update:
			return {
				...state,
				byStream: addPost(state.byStream, action.payload)
			};
		case PostsActionsType.AddPendingPost: {
			return { ...state, pending: [...state.pending, action.payload] };
		}
		case PostsActionsType.ResolvePendingPost: {
			const { pendingId, post } = action.payload;
			return {
				byStream: addPost(state.byStream, post),
				pending: state.pending.filter(post => post.id !== pendingId)
			};
		}
		case PostsActionsType.FailPendingPost: {
			return {
				...state,
				pending: state.pending.map(post => {
					return post.id === action.payload ? { ...post, error: true } : post;
				})
			};
		}
		case PostsActionsType.CancelPendingPost: {
			return {
				...state,
				pending: state.pending.filter(post => post.id !== action.payload)
			};
		}
		case PostsActionsType.Delete: {
			const { id, streamId } = action.payload;
			const streamPosts = { ...(state.byStream[streamId] || {}) };
			delete streamPosts[id];

			return {
				...state,
				byStream: { ...state.byStream, [streamId]: streamPosts }
			};
		}
		case "RESET":
			return initialState;
		default:
			return state;
	}
}

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
