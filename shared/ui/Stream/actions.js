import EventEmitter from "../event-emitter";
import { getChannelStreamsForTeam, getDirectMessageStreamsForTeam } from "../reducers/streams";
import { updatePreferences } from "../actions";
import {
	openPanel,
	closePanel,
	setThread,
	setCodemarkTypeFilter,
	setCodemarkFileFilter,
	setChannelFilter
} from "../store/context/actions";
import { saveCodemarks, updateCodemarks } from "../actions/codemarks";
import { logError } from "../logger";

export {
	openPanel,
	closePanel,
	setThread,
	setCodemarkTypeFilter,
	setCodemarkFileFilter,
	setChannelFilter
};

// uuid generator taken from: https://gist.github.com/jed/982883
const createTempId = a =>
	a
		? (a ^ ((Math.random() * 16) >> (a / 4))).toString(16)
		: ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, createTempId);

const resolvePendingPost = (pendingId, post) => ({
	type: "RESOLVE_PENDING_POST",
	payload: { pendingId, post }
});

export const markStreamRead = (streamId, postId) => (dispatch, getState, { api }) => {
	if (!streamId) return;
	api.markStreamRead(streamId, postId);
};

export const markPostUnread = (streamId, postId) => (dispatch, getState, { api }) => {
	if (!postId) return;
	console.log("CALLING API: ", api);
	api.markPostUnread(streamId, postId);
	// return dispatch({ type: "CLEAR_UMI", payload: streamId });
};

export const showMarkersInEditor = value => (dispatch, getState, { api }) => {
	api.showMarkersInEditor(value);
};

export const muteAllConversations = value => (dispatch, getState, { api }) => {
	api.muteAllConversations(value);
};

export const openCommentOnSelectInEditor = value => (dispatch, getState, { api }) => {
	api.openCommentOnSelectInEditor(value);
};

export const createPost = (streamId, parentPostId, text, codemark, mentions, extra) => async (
	dispatch,
	getState,
	{ api }
) => {
	const { context, session } = getState();
	const pendingId = createTempId();
	dispatch({
		type: "ADD_PENDING_POST",
		payload: {
			id: pendingId,
			streamId,
			parentPostId,
			text,
			codemark,
			creatorId: session.userId,
			createdAt: new Date().getTime(),
			pending: true
		}
	});
	try {
		const response = await api.createPost({
			id: pendingId,
			teamId: context.currentTeamId,
			parentPostId,
			streamId,
			text,
			codemark,
			mentions,
			extra
		});
		dispatch(resolvePendingPost(pendingId, response.post));
		response.codemark && dispatch(saveCodemarks([response.codemark]));
	} catch (error) {
		Logger.error(`Error creating a post: ${error.message}`, {
			stackTrace: error.stack
		});
		return dispatch({ type: "PENDING_POST_FAILED", payload: pendingId });
	}
};

export const retryPost = pendingId => async (dispatch, getState, { api }) => {
	const { posts } = getState();
	const pendingPost = posts.pending.find(post => post.id === pendingId);
	if (pendingPost) {
		const post = await api.createPost(pendingPost);
		return dispatch(resolvePendingPost(pendingId, post));
		// if it fails then what?
	} else {
		// what happened to the pending post?
	}
};

export const cancelPost = id => ({ type: "CANCEL_PENDING_POST", payload: id });

export const createSystemPost = (streamId, parentPostId, text, seqNum) => async (
	dispatch,
	getState
) => {
	const state = getState();
	const { context } = state;
	const pendingId = createTempId();

	const post = {
		id: pendingId,
		teamId: context.currentTeamId,
		timestamp: new Date().getTime(),
		createdAt: new Date().getTime(),
		creatorId: "codestream",
		parentPostId: parentPostId,
		streamId,
		seqNum,
		text
	};

	dispatch({ type: "ADD_POST", payload: post });
};

export const editPost = (streamId, id, text, mentions, codemark) => async (
	dispatch,
	getState,
	{ api }
) => {
	try {
		const response = await api.editPost({ streamId, id, text, mentions, codemark });
		dispatch({ type: "UPDATE_POST", payload: response.post });
	} catch (e) {
		// TODO:
		console.error("failed to edit post", e);
	}
};

export const reactToPost = (post, emoji, value) => async (dispatch, getState, { api }) => {
	try {
		const { session } = getState();
		// optimistically set it on the client... waiting for the server
		const reactions = { ...(post.reactions || {}) };
		reactions[emoji] = [...(reactions[emoji] || [])];
		if (value) reactions[emoji].push(session.userId);
		else reactions[emoji] = reactions[emoji].filter(id => id !== session.userId);

		dispatch({ type: "UPDATE_POST", payload: { ...post, reactions } });

		// then update it for real on the API server
		const updatedPost = await api.reactToPost({
			streamId: post.streamId,
			id: post.id,
			emoji,
			value
		});
		return dispatch({ type: "UPDATE_POST", payload: updatedPost });
	} catch (e) {
		console.error("failed to react", e);
	}
};

export const deletePost = (streamId, id) => async (dispatch, getState, { api }) => {
	try {
		const post = await api.deletePost({ streamId, id });
		return dispatch({ type: "DELETE_POST", payload: post });
	} catch (e) {
		// TODO
	}
};

// usage: setUserPreference(["favorites", "shoes", "wedges"], "red")
export const setUserPreference = (prefPath, value) => async (dispatch, getState, { api }) => {
	const { session, users } = getState();
	let user = users[session.userId];
	if (!user) return;

	// we walk down the existing user preference to set the value
	// and simultaneously create a new preference object to pass
	// to the API server
	let preferences = JSON.parse(JSON.stringify(user.preferences || {}));
	let preferencesPointer = preferences;
	let newPreference = {};
	let newPreferencePointer = newPreference;
	while (prefPath.length > 1) {
		let part = prefPath.shift().replace(/\./g, "*");
		if (!preferencesPointer[part]) preferencesPointer[part] = {};
		preferencesPointer = preferencesPointer[part];
		newPreferencePointer[part] = {};
		newPreferencePointer = newPreferencePointer[part];
	}
	preferencesPointer[prefPath[0].replace(/\./g, "*")] = value;
	newPreferencePointer[prefPath[0].replace(/\./g, "*")] = value;

	console.log("Saving preferences: ", newPreference);
	try {
		dispatch(updatePreferences(newPreference));
		api.saveUserPreference(newPreference);
	} catch (error) {
		console.error("error trying to update preferences", error);
	}
};

export const createStream = attributes => async (dispatch, getState, { api }) => {
	const { context } = getState();

	const stream = {
		teamId: context.currentTeamId,
		type: attributes.type
	};
	if (attributes.type === "channel") {
		stream.name = attributes.name;
		stream.privacy = attributes.privacy;
	}
	if (attributes.memberIds) stream.memberIds = attributes.memberIds;
	if (attributes.purpose) stream.purpose = attributes.purpose;

	try {
		const returnStream = await api.createStream(stream);
		dispatch({ type: "ADD_STREAM", payload: returnStream });
		dispatch(setCurrentStream(returnStream.id));

		//unmute any created streams
		dispatch(setUserPreference(["mutedStreams", returnStream.id], false));

		return returnStream;
	} catch (error) {
		console.log("Error: ", error);
	}
};

export const setCurrentStream = streamId => (dispatch, getState) => {
	const { context } = getState();
	// don't set the stream ID unless it actually changed
	if (context.currentStreamId !== streamId) {
		EventEmitter.emit("interaction:changed-active-stream", streamId);
		dispatch({ type: "SET_CURRENT_STREAM", payload: streamId });
	}
};

export const leaveChannel = streamId => async (dispatch, getState, { api }) => {
	const { context, session } = getState();

	try {
		const stream = await api.leaveStream(context.teamId, streamId);
		if (stream.privacy === "private") {
			dispatch({
				type: "REMOVE_STREAM",
				payload: { streamId, teamId: context.currentTeamId }
			});
		} else {
			dispatch({
				type: "UPDATE_STREAM",
				payload: { ...stream, memberIds: stream.memberIds.filter(id => id !== session.userId) }
			});
		}
		if (context.currentStreamId === streamId) {
			EventEmitter.emit("interaction:changed-active-stream", undefined);
			// this will take you to the #general channel
			dispatch(setCurrentStream(undefined));
			// dispatch(setPanel("channels"));
		}
	} catch (error) {
		console.error(error);
	}
};

export const removeUsersFromStream = (streamId, userIds) => async (dispatch, getState, { api }) => {
	try {
		const stream = await api.removeUsersFromStream(streamId, userIds);
		console.log("return stream: ", stream);
		// if (streams.length > 0) dispatch(saveStreams(normalize(streams)));
	} catch (error) {
		console.log("Error removing user(s) from stream: ", error);
	}
};

export const addUsersToStream = (streamId, userIds) => async (dispatch, getState, { api }) => {
	try {
		const stream = await api.addUsersToStream(streamId, userIds);
		console.log("return stream: ", stream);
		// if (streams.length > 0) dispatch(saveStreams(normalize(streams)));
	} catch (error) {
		console.log("Error adding user(s) to stream: ", error);
	}
};

export const joinStream = streamId => async (dispatch, getState, { api }) => {
	try {
		const teamId = getState().context.currentTeamId;
		const stream = await api.joinStream({ streamId, teamId });
		return dispatch({ type: "UPDATE_STREAM", payload: stream });
	} catch (error) {
		console.log("Error joining stream: ", error);
	}
};

export const renameStream = (streamId, name) => async (dispatch, getState, { api }) => {
	try {
		const stream = await api.renameStream(streamId, name);
		dispatch({ type: "UPDATE_STREAM", payload: stream });
		return stream;
	} catch (error) {
		console.error("Error renaming stream: ", error);
	}
};

export const setPurpose = (streamId, purpose) => async (dispatch, getState, { api }) => {
	try {
		const stream = await api.setStreamPurpose(streamId, purpose);
		dispatch({ type: "UPDATE_STREAM", payload: stream });
		return stream;
	} catch (error) {
		console.error("Error setting stream purpose: ", error);
	}
};

export const archiveStream = (streamId, archive) => async (dispatch, getState, { api }) => {
	try {
		const stream = await api.archiveStream(streamId, archive);
		if (stream) return dispatch({ type: "UPDATE_STREAM", payload: stream });
	} catch (error) {
		console.log(`Error ${archive ? "" : "un"}archiving stream: `, error);
	}
};

export const trackEvent = (eventName, properties) => async (dispatch, getState, { api }) => {
	console.log("(2) actions.js :: trackEvent called");
	try {
		await api.trackEvent(eventName, properties);
	} catch (error) {
		console.log("Error: ", error);
	}
};

export const invite = attributes => async (dispatch, getState, { api }) => {
	try {
		const user = await api.invite(attributes);
		return dispatch({ type: "ADD_USER", payload: user });
	} catch (error) {
		console.log("Error: ", error);
	}
};

export const fetchPosts = params => async (dispatch, getState, { api }) => {
	try {
		const response = await api.fetchPosts(params);
		dispatch({
			type: "ADD_POSTS_FOR_STREAM",
			payload: { posts: response.posts, streamId: params.streamId }
		});
		dispatch(saveCodemarks(response.codemarks));
		return response;
	} catch (error) {
		console.error(error);
	}
};

export const fetchThread = (streamId, parentPostId) => async (dispatch, getState, { api }) => {
	try {
		const { posts, codemarks } = await api.fetchThread(streamId, parentPostId);
		dispatch({
			type: "ADD_POSTS_FOR_STREAM",
			payload: { posts, streamId }
		});
		dispatch(saveCodemarks(codemarks));
		return posts;
	} catch (error) {
		console.error(error);
	}
};

export const fetchPostsForStreams = () => async (dispatch, getState) => {
	const { context, session, streams } = getState();

	try {
		const channels = getChannelStreamsForTeam(streams, context.currentTeamId, session.userId);
		const dms = getDirectMessageStreamsForTeam(streams, context.currentTeamId);
		[...channels, ...dms].forEach(channel => {
			dispatch(fetchPosts({ streamId: channel.id, teamId: context.currentTeamId }));
		});
	} catch (error) {
		console.error(error);
	}
};

export const showCode = (marker, enteringThread, source) => (dispatch, getState, { api }) => {
	return api.showCode(marker, enteringThread, source);
};

export const closeDirectMessage = id => async (dispatch, getState, { api }) => {
	try {
		return await api.closeDirectMessage(id);
	} catch (error) {
		console.error(error);
	}
};

export const openDirectMessage = id => async (dispatch, getState, { api }) => {
	try {
		return await api.openDirectMessage(id);
	} catch (error) {
		console.error(error);
	}
};

export const changeStreamMuteState = (streamId, muted) => async (dispatch, getState, { api }) => {
	const mutedStreams = getState().preferences.mutedStreams || {};

	try {
		dispatch(updatePreferences({ mutedStreams: { ...mutedStreams, [streamId]: muted } }));
		await api.changeStreamMuteState(streamId, muted);
	} catch (error) {
		console.error(error);
		// undo optimistic update
		// TODO: communicate failure
		dispatch(updatePreferences({ mutedStreams: { ...mutedStreams, [streamId]: !muted } }));
	}
};

export const editCodemark = attributes => async (dispatch, getState, { api }) => {
	try {
		const updatedCodemark = await api.editCodemark(attributes);
		dispatch(updateCodemarks([updatedCodemark]));
	} catch (error) {
		console.error("failed to update codemark", error);
	}
};

export const fetchCodemarks = () => async (dispatch, getState, { api }) => {
	try {
		const response = await api.fetchCodemarks(getState().context.currentTeamId);
		dispatch(saveCodemarks(response.codemarks));
	} catch (error) {
		console.error("failed to fetch codemarks", error);
	}
};

export const setCodemarkStatus = (id, status) => async (dispatch, getState, { api }) => {
	try {
		const response = await api.setCodemarkStatus({ id, status });
		dispatch(updateCodemarks([response.codemark]));
	} catch (error) {
		console.error("failed to change codemark status", error);
	}
};
