import { upsert } from "../local-cache";
import { saveMarkers } from "./marker";
import { saveMarkerLocations } from "./marker-location";

export const savePost = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "posts", attributes).then(post => {
		dispatch({
			type: "ADD_POST",
			payload: post
		});
	});
};

export const savePosts = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "posts", attributes).then(posts => {
		dispatch({
			type: "ADD_POSTS",
			payload: posts
		});
	});
};

export const savePostsForStream = (streamId, attributes) => (dispatch, getState, { db }) => {
	return upsert(db, "posts", attributes).then(posts => {
		dispatch({
			type: "ADD_POSTS_FOR_STREAM",
			payload: { streamId, posts }
		});
	});
};

export const savePendingPost = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "posts", attributes).then(post => {
		dispatch({
			type: "ADD_PENDING_POST",
			payload: post
		});
	});
};

export const resolvePendingPost = (id, { post, markers, markerLocations }) => (
	dispatch,
	getState,
	{ db }
) => {
	return db
		.transaction("rw", db.posts, async () => {
			await db.posts.delete(id);
			dispatch({
				type: "RESOLVE_PENDING_POST",
				payload: {
					pendingId: id,
					post
				}
			});
			await dispatch(savePost(post));
		})
		.then(async () => {
			// TODO: Should these be saved? the updates will be published through pubnub and cause double updates
			// await dispatch(saveMarkers(markers));
			// await dispatch(saveMarkerLocations(markerLocations));
		});
};

export const rejectPendingPost = (streamId, pendingId, post) => (dispatch, getState, { db }) => {
	// TODO
};
