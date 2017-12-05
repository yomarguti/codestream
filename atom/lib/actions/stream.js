import http from "../network-request";
import db from "../local-cache";
import { normalize } from "./utils";

const tempId = (() => {
	let count = 0;
	return () => String(count++);
})();

export const addStream = stream => dispatch => {
	return db.streams.put(stream).then(() => {
		dispatch({
			type: "ADD_STREAM",
			payload: stream
		});
	});
};

export const addPostsForStream = (streamId, posts) => dispatch => {
	return db.posts.bulkPut(posts).then(() => {
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
	db
		.transaction("rw", db.posts, async () => {
			await db.posts.delete(id);
			await db.posts.add(post);
		})
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
	const { posts } = await http.get(
		`/posts?teamId=${context.currentTeamId}&streamId=${stream.id}`,
		session.accessToken
	);
	await dispatch(addStream(stream));
	dispatch(addPostsForStream(stream.id, normalize(posts)));
};

export const createPost = (streamId, text) => async (dispatch, getState) => {
	const { session, currentTeamId } = getState();
	const pendingId = tempId();
	const post = {
		id: pendingId,
		teamId: currentTeamId,
		timestamp: new Date().getTime(),
		creatorId: session.userId,
		streamId,
		text
	};

	dispatch(addPendingPost(post));

	try {
		const data = await http.post("/posts", post, session.accessToken);
		dispatch(resolvePendingPost(pendingId, normalize(data.post)));
	} catch (error) {
		// TODO: different types of errors?
		dispatch(rejectPendingPost(streamId, pendingId, { ...post, error: true }));
	}
};
