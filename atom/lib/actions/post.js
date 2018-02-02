import Raven from "raven-js";
import { upsert } from "../local-cache";
import { normalize } from "./utils";
import { fetchMarkersAndLocations } from "./marker-location";
import { saveStream } from "./stream";

const createTempId = (() => {
	let count = 0;
	return () => String(count++);
})();

const pendingPostFailed = post => ({ type: "PENDING_POST_FAILED", payload: post });

const fetchLatest = (mostRecentPost, streamId, teamId) => async (dispatch, getState, { http }) => {
	let url = `/posts?teamId=${teamId}&streamId=${streamId}`;
	if (mostRecentPost) url += `&gt=${mostRecentPost.id}`;
	const { posts, more } = await http.get(url, getState().session.accessToken);
	const normalizedPosts = normalize(posts);
	const save = dispatch(savePostsForStream(streamId, normalizedPosts));
	// only take the first page if no mostRecentPost
	if (more && mostRecentPost) return dispatch(fetchLatest(normalizedPosts[0].id, streamId, teamId));
	else return save;
};

export const fetchLatestPosts = streams => (dispatch, getState, { db, http }) => {
	return Promise.all(
		streams.map(async stream => {
			const cachedPosts = await db.posts.where({ streamId: stream.id }).sortBy("seqNum");
			const mostRecentCachedPost = cachedPosts[cachedPosts.length - 1];
			return dispatch(fetchLatest(mostRecentCachedPost, stream.id, stream.teamId));
		})
	);
};

export const fetchPosts = ({ streamId, teamId }) => async (dispatch, getState, { db, http }) => {
	const { session } = getState();
	const { posts } = await http.get(
		`/posts?teamId=${teamId}&streamId=${streamId}`,
		session.accessToken
	);
	dispatch(savePostsForStream(streamId, normalize(posts)));
	return dispatch(fetchMarkersAndLocations({ streamId, teamId }));
};

export const savePost = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "posts", attributes).then(post =>
		dispatch({
			type: "ADD_POST",
			payload: post
		})
	);
};

export const savePosts = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "posts", attributes).then(posts =>
		dispatch({
			type: "ADD_POSTS",
			payload: posts
		})
	);
};

export const savePostsForStream = (streamId, attributes) => (dispatch, getState, { db }) => {
	return upsert(db, "posts", attributes).then(posts =>
		dispatch({
			type: "ADD_POSTS_FOR_STREAM",
			payload: { streamId, posts }
		})
	);
};

export const savePendingPost = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "posts", { ...attributes, pending: true }).then(post => {
		dispatch({
			type: "ADD_PENDING_POST",
			payload: post
		});
	});
};

export const createPost = (streamId, parentPostId, text, codeBlocks, mentions) => async (
	dispatch,
	getState,
	{ http }
) => {
	const { session, context } = getState();
	const pendingId = createTempId();

	const post = {
		id: pendingId,
		teamId: context.currentTeamId,
		timestamp: new Date().getTime(),
		creatorId: session.userId,
		parentPostId: parentPostId,
		codeBlocks: codeBlocks,
		commitHashWhenPosted: context.currentCommit,
		mentionedUserIds: mentions && mentions.length ? mentions : null,
		text
	};

	if (streamId) {
		post.streamId = streamId;
	} else
		post.stream = {
			teamId: context.currentTeamId,
			type: "file",
			file: context.currentFile,
			repoId: context.currentRepoId
		};

	dispatch(savePendingPost({ ...post }));

	try {
		const data = await http.post("/posts", post, session.accessToken);
		dispatch(
			resolvePendingPost(pendingId, {
				post: normalize(data.post),
				markers: normalize(data.markers),
				markerLocations: data.markerLocations,
				stream: streamId ? null : normalize(data.stream)
			})
		);
	} catch (error) {
		Raven.captureException(error, {
			logger: "actions/post"
		});
		// TODO: different types of errors?
		dispatch(rejectPendingPost(pendingId, { ...post, error: true }));
	}
};

export const resolvePendingPost = (id, { post, markers, markerLocations, stream }) => (
	dispatch,
	getState,
	{ db }
) => {
	return db
		.transaction("rw", db.posts, db.streams, async () => {
			await db.posts.delete(id);
			dispatch({
				type: "RESOLVE_PENDING_POST",
				payload: {
					pendingId: id,
					post
				}
			});
			if (stream) await dispatch(saveStream(stream));
		})
		.then(async () => {
			// TODO: Should these be saved? the updates will be published through pubnub and cause double updates
			// await dispatch(saveMarkers(markers));
			// await dispatch(saveMarkerLocations(markerLocations));
		});
};

export const rejectPendingPost = pendingId => (dispatch, getState, { db }) => {
	return upsert(db, "posts", { id: pendingId, error: true }).then(post =>
		dispatch(pendingPostFailed(post))
	);
};

export const cancelPost = pendingId => async (dispatch, getState, { db }) => {
	return db.posts
		.delete(pendingId)
		.then(() => dispatch({ type: "CANCEL_PENDING_POST", payload: pendingId }));
};

export const retryPost = pendingId => async (dispatch, getState, { db, http }) => {
	const pendingPost = await db.posts.get(pendingId);
	return http
		.post("/posts", pendingPost, getState().session.accessToken)
		.then(data =>
			dispatch(
				resolvePendingPost(pendingId, {
					post: normalize(data.post),
					markers: normalize(data.markers),
					markerLocations: data.markerLocations,
					stream: pendingPost.stream ? normalize(data.stream) : null
				})
			)
		)
		.catch(error => {
			Raven.captureBreadcrumb({
				message: "Failed to retry a post",
				category: "action",
				data: { error, pendingPost },
				level: "error"
			});
			dispatch(pendingPostFailed(pendingPost));
		});
};
