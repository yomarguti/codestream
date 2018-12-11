import EventEmitter from "../event-emitter";
import { logError, logWarning } from "../logger";
import { StreamType } from "../shared/api.protocol";
import { saveCodemarks, updateCodemarks } from "../store/codemarks/actions";
import * as contextActions from "../store/context/actions";
import {
	closePanel,
	openPanel,
	setChannelFilter,
	setCodemarkFileFilter,
	setCodemarkTypeFilter,
	setThread
} from "../store/context/actions";
import * as postsActions from "../store/posts/actions";
import { updatePreferences } from "../store/preferences/actions";
import * as streamActions from "../store/streams/actions";
import { getChannelStreamsForTeam, getDirectMessageStreamsForTeam } from "../store/streams/reducer";
import { addUsers } from "../store/users/actions";
import { uuid } from "../utils";
import WebviewApi from "../webview-api";

interface ThunkExtras {
	api: WebviewApi;
}

export {
	connectSlack,
	connectTrello,
	connectJira,
	connectGitHub,
	connectAsana
} from "../Signup/actions";
export {
	openPanel,
	closePanel,
	setThread,
	setCodemarkTypeFilter,
	setCodemarkFileFilter,
	setChannelFilter
};

export const setCurrentStream = contextActions.setCurrentStream;

export const markStreamRead = (streamId, postId) => (dispatch, getState, { api }: ThunkExtras) => {
	if (!streamId) return;
	api
		.markStreamRead(streamId, postId)
		.catch(error => logError(`There was an error marking a stream read: ${error}`, { streamId }));
};

export const markPostUnread = (streamId, postId) => (dispatch, getState, { api }: ThunkExtras) => {
	if (!postId) {
		logWarning(`Attempted to mark an undefined postId as unread in stream (${streamId})`);
		return;
	}
	api
		.markPostUnread(streamId, postId)
		.catch(error =>
			logError(`There was an error marking a post unread: ${error}`, { streamId, postId })
		);
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
	{ api }: ThunkExtras
) => {
	const { session } = getState();
	const pendingId = uuid();
	dispatch(
		postsActions.addPendingPost({
			id: pendingId,
			streamId,
			parentPostId,
			text,
			codemark,
			creatorId: session.userId,
			createdAt: new Date().getTime(),
			pending: true
		})
	);
	try {
		let responsePromise: ReturnType<typeof api.createPost>;
		if (codemark) {
			responsePromise = api.createPostWithCodemark(
				streamId,
				{
					parentPostId,
					mentionedUserIds: mentions
				},
				codemark,
				extra
			);
		} else {
			responsePromise = api.createPost(streamId, text, {
				mentionedUserIds: mentions,
				parentPostId
			});
		}
		const response = await responsePromise;
		response.codemark && dispatch(saveCodemarks([response.codemark]));
		response.streams &&
			response.streams.forEach(stream => dispatch(streamActions.updateStream(stream)));
		return dispatch(postsActions.resolvePendingPost(pendingId, response.post));
	} catch (error) {
		logError(`Error creating a post: ${error.message}`, {
			stackTrace: error.stack
		});
		return dispatch(postsActions.failPendingPost(pendingId));
	}
};

export const retryPost = pendingId => async (dispatch, getState, { api }) => {
	const { posts } = getState();
	const pendingPost = posts.pending.find(post => post.id === pendingId);
	if (pendingPost) {
		const post = await api.createPost(pendingPost);
		return dispatch(postsActions.resolvePendingPost(pendingId, post));
		// if it fails then what?
	} else {
		// what happened to the pending post?
	}
};

export const cancelPost = postsActions.cancelPendingPost;

export const createSystemPost = (streamId, parentPostId, text, seqNum) => async (
	dispatch,
	getState
) => {
	const state = getState();
	const { context } = state;
	const pendingId = uuid();

	const post = {
		id: pendingId,
		teamId: context.currentTeamId,
		timestamp: new Date().getTime(),
		createdAt: new Date().getTime(),
		creatorId: "codestream",
		parentPostId: parentPostId,
		streamId,
		seqNum,
		text,
		numReplies: 0,
		hasBeenEdited: false,
		modifiedAt: new Date().getTime()
	};

	dispatch(postsActions.addPosts([post]));
};

export const editPost = (streamId, postId, text, mentionedUserIds) => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	try {
		const response = await api.editPost(streamId, postId, text, mentionedUserIds);
		dispatch(postsActions.updatePost(response.post));
	} catch (error) {
		logError(`There was an error editing a post: ${error}`, { streamId, postId, text });
	}
};

export const reactToPost = (post, emoji, value) => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	try {
		const { session } = getState();
		// optimistically set it on the client... waiting for the server
		const reactions = { ...(post.reactions || {}) };
		reactions[emoji] = [...(reactions[emoji] || [])];
		if (value) reactions[emoji].push(session.userId);
		else reactions[emoji] = reactions[emoji].filter(id => id !== session.userId);

		dispatch(postsActions.updatePost({ ...post, reactions }));

		// then update it for real on the API server
		const response = await api.reactToPost(post.streamId, post.id, { [emoji]: value });
		return dispatch(postsActions.updatePost(response.post));
	} catch (error) {
		logError(`There was an error reacting to a post: ${error}`, { post, emoji, value });
	}
};

export const deletePost = (streamId, id) => async (dispatch, getState, { api }: ThunkExtras) => {
	try {
		const { post } = await api.deletePost({ streamId, postId: id });
		return dispatch(postsActions.deletePost(post));
	} catch (error) {
		logError(`There was an error deleting a post: ${error}`, { streamId, postId: id });
	}
};

// usage: setUserPreference(["favorites", "shoes", "wedges"], "red")
export const setUserPreference = (prefPath, value) => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	const { session, users } = getState();
	const user = users[session.userId];
	if (!user) return;

	// we walk down the existing user preference to set the value
	// and simultaneously create a new preference object to pass
	// to the API server
	const preferences = JSON.parse(JSON.stringify(user.preferences || {}));
	let preferencesPointer = preferences;
	const newPreference = {};
	let newPreferencePointer = newPreference;
	while (prefPath.length > 1) {
		const part = prefPath.shift().replace(/\./g, "*");
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
		await api.saveUserPreference(newPreference);
	} catch (error) {
		logError(`Error trying to update preferences: ${error.message}`);
	}
};

export const createStream = (
	attributes:
		| {
				name: string;
				type: StreamType.Channel;
				memberIds: string[];
				privacy: "public" | "private";
				purpose?: string;
		  }
		| { type: StreamType.Direct; memberIds: string[] }
) => async (dispatch, getState, { api }: ThunkExtras) => {
	let responsePromise;
	if (attributes.type === StreamType.Channel) {
		responsePromise = api.createChannel(
			attributes.name,
			attributes.memberIds,
			attributes.privacy,
			attributes.purpose
		);
	} else {
		responsePromise = api.createDirectMessage(attributes.memberIds);
	}

	try {
		const response = await responsePromise!;
		dispatch(streamActions.addStreams([response.stream]));
		dispatch(contextActions.setCurrentStream(response.stream.id));

		// unmute any created streams
		dispatch(setUserPreference(["mutedStreams", response.stream.id], false));

		return response.stream;
	} catch (error) {
		logError(`There was an error creating a channel: ${error}`, attributes);
	}
};

export const leaveChannel = streamId => async (dispatch, getState, { api }: ThunkExtras) => {
	const { context, session } = getState();

	try {
		const { stream } = await api.leaveStream(streamId);
		if (stream.privacy === "private") {
			dispatch(streamActions.remove(streamId, context.currentTeamId));
		} else {
			dispatch(
				streamActions.updateStream({
					...stream,
					memberIds: stream.memberIds!.filter(id => id !== session.userId)
				})
			);
		}
		if (context.currentStreamId === streamId) {
			EventEmitter.emit("interaction:changed-active-stream", undefined);
			// this will take you to the #general channel
			dispatch(contextActions.setCurrentStream(undefined));
			// dispatch(setPanel("channels"));
		}
	} catch (error) {
		logError(`There was an error leaving a channel: ${error}`, { streamId });
	}
};

export const removeUsersFromStream = (streamId: string, userIds: string[]) => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	try {
		await api.removeUsersFromStream(streamId, userIds);
		// dispatch(streamActions.update(stream));
	} catch (error) {
		logError(`There was an error removing user(s) from a stream: ${error}`, { streamId, userIds });
	}
};

export const addUsersToStream = (streamId: string, userIds: string[]) => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	try {
		await api.addUsersToStream(streamId, userIds);
		// if (streams.length > 0) dispatch(saveStreams(normalize(streams)));
	} catch (error) {
		logError(`There was an error adding user(s) to a stream: ${error}`, { streamId, userIds });
	}
};

export const joinStream = streamId => async (dispatch, getState, { api }: ThunkExtras) => {
	try {
		const { stream } = await api.joinStream(streamId);
		return dispatch(streamActions.updateStream(stream));
	} catch (error) {
		logError(`There was an error joining a stream: ${error}`, { streamId });
	}
};

export const renameStream = (streamId, name) => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	try {
		const { stream } = await api.renameStream(streamId, name);
		return dispatch(streamActions.updateStream(stream));
	} catch (error) {
		logError(`There was an error renaming a stream: ${error}`, { streamId, name });
	}
};

export const setPurpose = (streamId, purpose) => async (dispatch, getState, { api }) => {
	try {
		const { stream } = await api.setStreamPurpose(streamId, purpose);
		return dispatch(streamActions.updateStream(stream));
	} catch (error) {
		logError(`There was an error setting stream purpose: ${error}`, { streamId });
	}
};

export const archiveStream = (streamId, archive = true) => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	try {
		const { stream } = archive
			? await api.archiveStream(streamId)
			: await api.unarchiveStream(streamId);
		if (stream) return dispatch(streamActions.updateStream(stream));
	} catch (error) {
		logError(`There was an error ${archive ? "" : "un"}archiving stream: ${error}`, { streamId });
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

export const invite = (attributes: { email: string; fullName?: string }) => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	try {
		const response = await api.invite(attributes);
		return dispatch(addUsers([response.user]));
	} catch (error) {
		logError(`There was an error inviting a user: ${error}`, attributes);
	}
};

export const fetchPosts = (params: { streamId: string; limit?: number; before?: string }) => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	try {
		const response = await api.fetchPosts(params);
		dispatch(postsActions.addPostsForStream(params.streamId, response.posts));
		response.codemarks && dispatch(saveCodemarks(response.codemarks));
		return response;
	} catch (error) {
		logError(`There was an error fetching posts: ${error}`, params);
	}
};

export const fetchThread = (streamId, parentPostId) => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	try {
		const { posts, codemarks } = await api.fetchThread(streamId, parentPostId);
		dispatch(postsActions.addPostsForStream(streamId, posts));
		codemarks && dispatch(saveCodemarks(codemarks));
		return posts;
	} catch (error) {
		logError(`There was an error fetching a thread: ${error}`, { parentPostId });
	}
};

export const fetchPostsForStreams = () => async (dispatch, getState) => {
	const { context, session, streams } = getState();

	try {
		const channels = getChannelStreamsForTeam(streams, context.currentTeamId, session.userId);
		const dms = getDirectMessageStreamsForTeam(streams, context.currentTeamId);
		[...channels, ...dms].forEach(channel => {
			dispatch(fetchPosts({ streamId: channel.id }));
		});
	} catch (error) {
		console.error(error);
	}
};

export const showCode = (marker, enteringThread, source) => (dispatch, getState, { api }) => {
	return api.showCode(marker, enteringThread, source);
};

export const highlightCode = (marker, onOff, source) => (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	return api.highlightCode(marker, onOff, source);
};

export const closeDirectMessage = id => async (dispatch, getState, { api }: ThunkExtras) => {
	try {
		const { stream } = await api.closeDirectMessage(id);
		dispatch(streamActions.updateStream(stream));
	} catch (error) {
		logError(`There was an error closing a dm: ${error}`);
	}
};

export const openDirectMessage = id => async (dispatch, getState, { api }: ThunkExtras) => {
	try {
		const response = await api.openDirectMessage(id);
		return dispatch(streamActions.updateStream(response.stream));
	} catch (error) {
		logError(`There was an error opening a dm: ${error}`);
	}
};

export const changeStreamMuteState = (streamId: string, mute: boolean) => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	const mutedStreams = getState().preferences.mutedStreams || {};

	try {
		dispatch(updatePreferences({ mutedStreams: { ...mutedStreams, [streamId]: mute } }));
		await api.changeStreamMuteState(streamId, mute);
	} catch (error) {
		logError(`There was an error toggling mute state of ${streamId}: ${error}`);
		// TODO: communicate failure
		dispatch(updatePreferences({ mutedStreams: { ...mutedStreams, [streamId]: !mute } }));
	}
};

export const editCodemark = (id: string, attributes: {}) => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	try {
		const response = await api.editCodemark(id, attributes);
		dispatch(updateCodemarks([response.codemark]));
	} catch (error) {
		console.error("failed to update codemark", error);
	}
};

export const fetchCodemarks = () => async (dispatch, getState, { api }: ThunkExtras) => {
	try {
		const response = await api.fetchCodemarks();
		dispatch(saveCodemarks(response.codemarks));
	} catch (error) {
		console.error("failed to fetch codemarks", error);
	}
};

export const setCodemarkStatus = (id: string, status: "closed" | "open") => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	try {
		const response = await api.setCodemarkStatus(id, status);
		dispatch(updateCodemarks([response.codemark]));
	} catch (error) {
		console.error("failed to change codemark status", error);
	}
};

export const telemetry = (params: { eventName: string; properties: {} }) => async (
	dispatch,
	getState,
	{ api }: ThunkExtras
) => {
	try {
		await api.sendTelemetry(params);
	} catch (error) {
		logError(`Telemetry error: ${error}`, params);
	}
};

export const fetchTrelloBoards = () => async (dispatch, getState, { api }) => {
	try {
		const response = await api.fetchTrelloBoards();
		return response;
		// dispatch(saveCodemarks(response.codemarks));
	} catch (error) {
		console.error("failed to fetch trello boards", error);
	}
};

export const createTrelloCard = (listId: string, name: string, description: string) => async (
	dispatch,
	getState,
	{ api }
) => {
	try {
		const response = await api.createTrelloCard(listId, name, description);
		return response;
	} catch (error) {
		console.error("failed to create a trello card", error);
	}
};
