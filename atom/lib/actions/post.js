import Raven from "raven-js";
import { upsert } from "../local-cache";
import { normalize } from "./utils";
import * as pubnubActions from "./pubnub-event";
import { calculateLocations } from "./marker-location";
import { fetchTeamStreams } from "./stream";
import { saveMarkers } from "./marker";
import { saveMarkerLocations } from "./marker-location";
import { getStreamForTeam } from "../reducers/streams";

const fetchLatest = (mostRecentPost, streamId, teamId) => async (dispatch, getState, { http }) => {
	const { context } = getState();
	let url = `/posts?teamId=${teamId}&streamId=${streamId}&withMarkers`;
	if (context.currentCommit) url += `&commitHash=${context.currentCommit}`;
	if (mostRecentPost) url += `&gt=${mostRecentPost.id}`;
	const { posts, markers, markerLocations, more } = await http.get(
		url,
		getState().session.accessToken
	);
	const normalizedMarkers = normalize(markers || []);
	dispatch(saveMarkers(normalizedMarkers));
	if (markerLocations) dispatch(saveMarkerLocations(markerLocations));
	const normalizedPosts = normalize(posts);
	const save = dispatch(savePostsForStream(streamId, normalizedPosts));
	// only take the first page if no mostRecentPost
	if (more && mostRecentPost) return dispatch(fetchLatest(normalizedPosts[0].id, streamId, teamId));
	else return save;
};

export const fetchLatestPosts = streams => (dispatch, getState, { db }) => {
	return Promise.all(
		streams.map(async stream => {
			const cachedPosts = await db.posts.where({ streamId: stream.id }).sortBy("seqNum");
			const mostRecentCachedPost = cachedPosts[cachedPosts.length - 1];
			return dispatch(fetchLatest(mostRecentCachedPost, stream.id, stream.teamId));
		})
	);
};

// FIXME: tech debt. these next two functions are only for use when starting with a clean local cache until
// the streams support lazy loading and infinite lists
const fetchOlderPosts = (mostRecentPost, streamId, teamId) => async (
	dispatch,
	getState,
	{ http }
) => {
	const { context, session } = getState();
	let url = `/posts?teamId=${teamId}&streamId=${streamId}&withMarkers&commitHash=${
		context.currentCommit
	}`;
	if (mostRecentPost) url += `&lt=${mostRecentPost.id}`;
	const { posts, markers, markerLocations, more } = await http.get(url, session.accessToken);
	const normalizedMarkers = normalize(markers || []);
	dispatch(saveMarkers(normalizedMarkers));
	if (markerLocations) dispatch(saveMarkerLocations(markerLocations));
	const normalizedPosts = normalize(posts);
	console.log("OLDER NORMALIZED POSTS ARE: ", posts);
	const save = dispatch(savePostsForStream(streamId, normalizedPosts));
	if (more)
		return dispatch(fetchOlderPosts(normalizedPosts[normalizedPosts.length - 1], streamId, teamId));
	else return save;
};

export const fetchAllPosts = streams => dispatch => {
	return Promise.all(
		streams.map(async stream => {
			dispatch(fetchOlderPosts(null, stream.id, stream.teamId));
		})
	);
};

export const fetchLatestForTeamStream = () => async (dispatch, getState) => {
	const { streams, context } = getState();

	const teamStream = getStreamForTeam(streams, context.currentTeamId);
	if (teamStream) return dispatch(fetchLatestPosts([teamStream]));
	else {
		return dispatch(fetchTeamStreams(true));
	}
};

export const fetchPosts = ({ streamId, teamId }) => async (dispatch, getState, { http }) => {
	const { session } = getState();
	const { posts } = await http.get(
		`/posts?teamId=${teamId}&streamId=${streamId}`,
		session.accessToken
	);
	dispatch(savePostsForStream(streamId, normalize(posts)));
	return dispatch(calculateLocations({ streamId, teamId }));
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

export const resolveFromPubnub = (post, isHistory) => async (dispatch, getState) => {
	Raven.captureBreadcrumb({
		message: "Attempting to resolve a post from pubnub.",
		category: "action"
	});

	const { session } = getState();
	const isNotFromCurrentUser = post.creatorId !== session.userId;
	const isFromEmailOrSlack = !post.commitHashWhenPosted; // crude. right now posts from email won't ever have commit context

	if (isHistory || isNotFromCurrentUser || isFromEmailOrSlack) {
		Raven.captureBreadcrumb({
			message: "Post is history, does not belong to current user, or it might be from email.",
			category: "action",
			data: { isHistory, isNotFromCurrentUser, isFromEmailOrSlack }
		});
		return dispatch(pubnubActions.resolveFromPubnub("posts", post, isHistory));
	}
};
