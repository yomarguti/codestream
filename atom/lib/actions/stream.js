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

export const savePostsForStream = (streamId, posts) => dispatch => {
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

const saveMarkers = markers => dispatch => {
	return db.markers.bulkPut(markers).then(() => {
		dispatch({
			type: "ADD_MARKERS",
			payload: markers
		});
	});
};

const saveMarkerLocations = locations => dispatch => {
	return db.markerLocations
		.put(locations)
		.then(() => {
			dispatch({
				type: "ADD_MARKER_LOCATIONS",
				payload: locations
			});
		})
		.catch("DataError", () => {
			/* DataError is thrown when the primary key is not on the object. We can swallow that since it's no-op*/
		});
};

const resolvePendingPost = (id, data) => dispatch => {
	const post = normalize(data.post);
	const markers = normalize(data.markers);
	const { markerLocations } = data;
	return db
		.transaction("rw", db.posts, async () => {
			await db.posts.delete(id);
			await db.posts.add(post);
		})
		.then(async () => {
			await dispatch(saveMarkers(markers));
			await dispatch(saveMarkerLocations(markerLocations));
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
	const { session, context, streams } = getState();
	if (!streams.isFetching) {
		dispatch({ type: "FETCH_STREAM" });
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
		dispatch({ type: "RECEIVE_STREAM" });
		const stream = normalize(streamData.stream);
		const { posts } = await http.get(
			`/posts?teamId=${context.currentTeamId}&streamId=${stream.id}`,
			session.accessToken
		);
		const { markers, markerLocations } = await http.get(
			`/markers?teamId=${context.currentTeamId}&streamId=${stream.id}&commitHash=${
				context.currentCommit
			}`,
			session.accessToken
		);
		await dispatch(addStream(stream));
		await dispatch(saveMarkers(normalize(markers)));
		await dispatch(saveMarkerLocations(normalize(markerLocations)));
		dispatch(savePostsForStream(stream.id, normalize(posts)));
	}
};

export const createPost = (streamId, parentPostId, text, codeBlocks) => async (
	dispatch,
	getState
) => {
	const { session, context } = getState();
	const pendingId = tempId();

	let post = {
		id: pendingId,
		teamId: context.currentTeamId,
		timestamp: new Date().getTime(),
		creatorId: session.userId,
		parentPostId: parentPostId,
		codeBlocks: codeBlocks,
		commitHashWhenPosted: context.currentCommit,
		streamId,
		text
	};

	dispatch(addPendingPost(post));

	try {
		const data = await http.post("/posts", post, session.accessToken);
		dispatch(resolvePendingPost(pendingId, data));
	} catch (error) {
		// TODO: different types of errors?
		dispatch(rejectPendingPost(streamId, pendingId, { ...post, error: true }));
	}
};
