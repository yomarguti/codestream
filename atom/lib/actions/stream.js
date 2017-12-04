import http from "../network-request";
import db from "../local-cache";
import { normalize } from "./utils";

export const addStream = stream => dispatch => {
	db.streams.put(stream).then(() => {
		dispatch({
			type: "ADD_STREAM",
			payload: stream
		});
	});
};

export const addPostsForStream = (streamId, posts) => dispatch => {
	db.posts.bulkPut(posts).then(() => {
		dispatch({
			type: "ADD_POSTS_FOR_STREAM",
			payload: { streamId, posts }
		});
	});
};

const addPendingPost = post => dispatch => {
	db.posts.add(post).then(() => {
		dispatch({
			type: "ADD_PENDING_POST",
			payload: post
		});
	});
};

const resolvePendingPost = (id, post) => dispatch => {
	db.posts
		.delete(id)
		.then(() => db.posts.add(post))
		.then(() => {
			dispatch({
				type: "RESOLVE_PENDING_POST",
				payload: {
					pendingId: id,
					post
				}
			});
		});
};

const rejectPendingPost = (streamId, pendingId, post) => dispatch => {
	// TODO
};

export const fetchStream = () => async (dispatch, getState) => {
	const { session, context } = getState();
	// create stream - right now the server doesn't complain if a stream already exists
	const streamData = await http.post(
		"/streams",
		{
			teamId: context.currentTeamId,
			type: "file",
			file: context.currentFile,
			repoId: context.currentRepoId
		},
		session.accessToken
	);
	const stream = normalize(streamData.stream);
	dispatch(addStream(stream));
	const { posts } = await http.get(
		`/posts?teamId=${context.currentTeamId}&streamId=${stream.id}`,
		session.accessToken
	);
	dispatch(addPostsForStream(stream.id, normalize(posts)));
};

export const createPost = (streamId, text) => async (dispatch, getState) => {
	const { session, currentTeamId } = getState();
	const post = {
		id: "temp1",
		teamId: currentTeamId,
		timestamp: new Date().getTime(),
		streamId,
		text
	};

	dispatch(addPendingPost(post));

	try {
		const data = await http.post("/posts", post, session.accessToken);
		dispatch(resolvePendingPost("temp1", normalize(data.post)));
	} catch (error) {
		// TODO: different types of errors?
		dispatch(rejectPendingPost(streamId, "temp1", { ...post, error: true }));
	}
};
