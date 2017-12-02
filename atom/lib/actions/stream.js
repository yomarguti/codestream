import http from "../network-request";
import db from "../local-cache";

export const addStream = stream => dispatch => {
	stream = { ...stream, id: stream._id };
	db.streams.put(stream).then(() => {
		dispatch({
			type: "ADD_STREAM",
			payload: stream
		});
	});
};

export const addPostsForStream = (streamId, posts) => dispatch => {
	posts = posts.map(post => ({ ...post, id: post._id }));
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
	// TODO: use a transaction
	post = { ...post, id: post._id };
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
	const { accessToken, currentFile, repos, repoMetadata } = getState();
	const { teamId, _id } = repos.find(repo => repo.url === repoMetadata.url);
	// create stream - right now the server doesn't complain if a stream already exists
	const { stream } = await http.post(
		"/streams",
		{ teamId, type: "file", file: currentFile, repoId: _id },
		accessToken
	);

	dispatch(addStream(stream));
	const streamId = stream._id;
	const { posts } = await http.get(`/posts?teamId=${teamId}&streamId=${streamId}`, accessToken);
	dispatch(addPostsForStream(streamId, posts));
};

export const createPost = text => async (dispatch, getState) => {
	const { accessToken, currentFile, repos, repoMetadata, streams } = getState();
	const { teamId } = repos.find(repo => repo.url === repoMetadata.url);
	const stream = streams.find(stream => stream.file === currentFile);

	const post = { id: "temp1", teamId, streamId: stream.id, text, timestamp: new Date().getTime() };

	dispatch(addPendingPost(post));

	try {
		const data = await http.post("/posts", post, accessToken);
		dispatch(resolvePendingPost("temp1", data.post));
	} catch (error) {
		// TODO: different types of errors?
		dispatch(rejectPendingPost(stream.id, "temp1", { ...post, error: true }));
	}
};
