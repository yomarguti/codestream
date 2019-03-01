import {
	ArchiveStreamRequestType,
	AsanaCreateCardRequestType,
	BitbucketCreateCardRequestType,
	CloseStreamRequestType,
	CreateChannelStreamRequestType,
	CreateChannelStreamResponse,
	CreateDirectStreamRequestType,
	CreateDirectStreamResponse,
	CreateJiraCardRequestType,
	CreatePostRequestType,
	CreatePostResponse,
	CreatePostWithMarkerRequestType,
	DeletePostRequestType,
	EditPostRequestType,
	FetchCodemarksRequestType,
	FetchPostRepliesRequestType,
	FetchPostsRequestType,
	GitHubCreateCardRequestType,
	GitLabCreateCardRequestType,
	InviteUserRequestType,
	JoinStreamRequestType,
	LeaveStreamRequestType,
	MarkPostUnreadRequestType,
	MarkStreamReadRequestType,
	MuteStreamRequestType,
	OpenStreamRequestType,
	ReactToPostRequestType,
	RenameStreamRequestType,
	SetStreamPurposeRequestType,
	TrelloCreateCardRequestType,
	UnarchiveStreamRequestType,
	UpdateCodemarkRequestType,
	UpdatePreferencesRequestType,
	UpdateStreamMembershipRequestType
} from "@codestream/protocols/agent";
import { CSPost, StreamType } from "@codestream/protocols/api";
import { WebviewDidChangeActiveStreamNotificationType } from "../ipc/webview.protocol";
import { logError } from "../logger";
import { saveCodemarks, updateCodemarks } from "../store/codemarks/actions";
import {
	closePanel,
	openPanel,
	setChannelFilter,
	setCodemarkColorFilter,
	setCodemarkFileFilter,
	setCodemarkTypeFilter,
	setThread
} from "../store/context/actions";
import * as contextActions from "../store/context/actions";
import * as postsActions from "../store/posts/actions";
import { updatePreferences } from "../store/preferences/actions";
import * as streamActions from "../store/streams/actions";
import { addUsers } from "../store/users/actions";
import { uuid } from "../utils";
import { HostApi } from "../webview-api";

export { connectProvider as connectService, disconnectService } from "../store/context/actions";
export {
	openPanel,
	closePanel,
	setThread,
	setCodemarkTypeFilter,
	setCodemarkFileFilter,
	setCodemarkColorFilter,
	setChannelFilter
};

export const markStreamRead = (streamId: string, postId?: string) => () => {
	HostApi.instance
		.send(MarkStreamReadRequestType, { streamId, postId })
		.catch(error => logError(`There was an error marking a stream read: ${error}`, { streamId }));
};

export const markPostUnread = (streamId: string, postId: string) => () => {
	HostApi.instance
		.send(MarkPostUnreadRequestType, { streamId, postId })
		.catch(error =>
			logError(`There was an error marking a post unread: ${error}`, { streamId, postId })
		);
};

export const createPost = (
	streamId: string,
	parentPostId: string | undefined,
	text: string,
	codemark: any,
	mentions: string[],
	extra: any
) => async (dispatch, getState) => {
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
		let responsePromise: Promise<CreatePostResponse>;
		if (codemark) {
			let externalProviderUrl;
			let externalProvider;
			let externalAssignees;
			if (extra.crossPostIssueValues) {
				const cardResponse = await createServiceCard(extra.crossPostIssueValues, codemark);
				if (cardResponse) {
					externalProviderUrl = cardResponse.url;
					externalProvider = extra.crossPostIssueValues.provider;
					externalAssignees = extra.crossPostIssueValues.assignees;
				}
			}
			const block = codemark.markers[0] || {};
			responsePromise = HostApi.instance.send(CreatePostWithMarkerRequestType, {
				streamId,
				text: codemark.text,
				textDocument: { uri: extra.fileUri },
				code: block.code,
				range: block.range,
				source: block.source,
				title: codemark.title,
				type: codemark.type,
				assignees: codemark.assignees,
				color: codemark.color,
				mentionedUserIds: mentions,
				entryPoint: extra.entryPoint,
				externalProvider,
				externalAssignees,
				externalProviderUrl,
				parentPostId
			});
		} else {
			responsePromise = HostApi.instance.send(CreatePostRequestType, {
				streamId,
				text,
				parentPostId,
				mentionedUserIds: mentions,
				entryPoint: extra.entryPoint
			});
		}
		const response = await responsePromise;
		response.codemark && dispatch(saveCodemarks([response.codemark]));
		response.streams &&
			response.streams.forEach(stream => dispatch(streamActions.updateStream(stream)));
		return dispatch(postsActions.resolvePendingPost(pendingId, response.post));
	} catch (error) {
		logError(`Error creating a post: ${error}`, {
			stackTrace: error.stack
		});
		return dispatch(postsActions.failPendingPost(pendingId));
	}
};

export const retryPost = pendingId => async (dispatch, getState) => {
	const { posts } = getState();
	const pendingPost = posts.pending.find(post => post.id === pendingId);
	if (pendingPost) {
		const { post } = await HostApi.instance.send(CreatePostRequestType, pendingPost);
		return dispatch(postsActions.resolvePendingPost(pendingId, post));
		// if it fails then what?
	} else {
		// what happened to the pending post?
	}
};

export const cancelPost = postsActions.cancelPendingPost;

export const createSystemPost = (
	streamId: string,
	parentPostId: string,
	text: string,
	seqNum: number | string
) => async (dispatch, getState) => {
	const { context } = getState();
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

export const editPost = (
	streamId: string,
	postId: string,
	text: string,
	mentionedUserIds?: string[]
) => async dispatch => {
	try {
		const response = await HostApi.instance.send(EditPostRequestType, {
			streamId,
			postId,
			text,
			mentionedUserIds
		});
		dispatch(postsActions.updatePost(response.post));
	} catch (error) {
		logError(`There was an error editing a post: ${error}`, { streamId, postId, text });
	}
};

export const reactToPost = (post: CSPost, emoji: string, value: boolean) => async (
	dispatch,
	getState
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
		const response = await HostApi.instance.send(ReactToPostRequestType, {
			streamId: post.streamId,
			postId: post.id,
			emojis: { [emoji]: value }
		});
		return dispatch(postsActions.updatePost(response.post));
	} catch (error) {
		logError(`There was an error reacting to a post: ${error}`, { post, emoji, value });
	}
};

export const deletePost = (streamId: string, postId: string) => async dispatch => {
	try {
		const { post } = await HostApi.instance.send(DeletePostRequestType, { streamId, postId });
		return dispatch(postsActions.deletePost(post));
	} catch (error) {
		logError(`There was an error deleting a post: ${error}`, { streamId, postId });
	}
};

// usage: setUserPreference(["favorites", "shoes", "wedges"], "red")
export const setUserPreference = (prefPath: string[], value: any) => async (dispatch, getState) => {
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
		const part = prefPath.shift()!.replace(/\./g, "*");
		if (!preferencesPointer[part]) preferencesPointer[part] = {};
		preferencesPointer = preferencesPointer[part];
		newPreferencePointer[part] = {};
		newPreferencePointer = newPreferencePointer[part];
	}
	preferencesPointer[prefPath[0].replace(/\./g, "*")] = value;
	newPreferencePointer[prefPath[0].replace(/\./g, "*")] = value;

	try {
		dispatch(updatePreferences(newPreference));
		await HostApi.instance.send(UpdatePreferencesRequestType, { preferences: newPreference });
	} catch (error) {
		logError(`Error trying to update preferences: ${error}`);
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
) => async dispatch => {
	let responsePromise: Promise<CreateChannelStreamResponse | CreateDirectStreamResponse>;
	if (attributes.type === StreamType.Channel) {
		responsePromise = HostApi.instance.send(CreateChannelStreamRequestType, {
			type: StreamType.Channel,
			name: attributes.name,
			memberIds: attributes.memberIds,
			privacy: attributes.privacy,
			purpose: attributes.purpose,
			isTeamStream: false
		});
	} else {
		responsePromise = HostApi.instance.send(CreateDirectStreamRequestType, {
			type: StreamType.Direct,
			memberIds: attributes.memberIds
		});
	}

	try {
		const response = await responsePromise!;
		dispatch(streamActions.addStreams([response.stream]));
		dispatch(contextActions.setCurrentStream(response.stream.id));

		// unmute any created streams
		dispatch(setUserPreference(["mutedStreams", response.stream.id], false));

		return response.stream;
	} catch (error) {
		/* TODO: Handle errors
				- handle name taken errors
				- restricted actions
				- users can't join
		*/
		logError(`There was an error creating a channel: ${error}`, attributes);
	}
};

export const leaveChannel = (streamId: string) => async (dispatch, getState) => {
	const { context, session } = getState();

	try {
		const { stream } = await HostApi.instance.send(LeaveStreamRequestType, { streamId });
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
			HostApi.instance.notify(WebviewDidChangeActiveStreamNotificationType, {});
			// this will take you to the #general channel
			dispatch(contextActions.setCurrentStream(undefined));
			// dispatch(setPanel("channels"));
		}
	} catch (error) {
		logError(`There was an error leaving a channel: ${error}`, { streamId });
	}
};

export const removeUsersFromStream = async (streamId: string, userIds: string[]) => {
	try {
		await HostApi.instance.send(UpdateStreamMembershipRequestType, {
			streamId,
			remove: userIds
		});
		// dispatch(streamActions.update(stream));
	} catch (error) {
		logError(`There was an error removing user(s) from a stream: ${error}`, { streamId, userIds });
	}
};

export const addUsersToStream = async (streamId: string, userIds: string[]) => {
	try {
		await HostApi.instance.send(UpdateStreamMembershipRequestType, { streamId, add: userIds });
		// if (streams.length > 0) dispatch(saveStreams(normalize(streams)));
	} catch (error) {
		logError(`There was an error adding user(s) to a stream: ${error}`, { streamId, userIds });
	}
};

export const joinStream = (streamId: string) => async dispatch => {
	try {
		const { stream } = await HostApi.instance.send(JoinStreamRequestType, { streamId });
		return dispatch(streamActions.updateStream(stream));
	} catch (error) {
		logError(`There was an error joining a stream: ${error}`, { streamId });
	}
};

export const renameStream = (streamId: string, name: string) => async dispatch => {
	try {
		const { stream } = await HostApi.instance.send(RenameStreamRequestType, { streamId, name });
		return dispatch(streamActions.updateStream(stream));
	} catch (error) {
		logError(`There was an error renaming a stream: ${error}`, { streamId, name });
	}
};

export const setPurpose = (streamId: string, purpose: string) => async dispatch => {
	try {
		const { stream } = await HostApi.instance.send(SetStreamPurposeRequestType, {
			streamId,
			purpose
		});
		return dispatch(streamActions.updateStream(stream));
	} catch (error) {
		logError(`There was an error setting stream purpose: ${error}`, { streamId });
	}
};

export const archiveStream = (streamId: string, archive = true) => async dispatch => {
	try {
		const command = archive ? ArchiveStreamRequestType : UnarchiveStreamRequestType;
		const { stream } = await HostApi.instance.send(command, { streamId });
		if (stream) return dispatch(streamActions.updateStream(stream));
	} catch (error) {
		logError(`There was an error ${archive ? "" : "un"}archiving stream: ${error}`, { streamId });
	}
};

export const invite = (attributes: { email: string; fullName?: string }) => async dispatch => {
	try {
		const response = await HostApi.instance.send(InviteUserRequestType, attributes);
		return dispatch(addUsers([response.user]));
	} catch (error) {
		logError(`There was an error inviting a user: ${error}`, attributes);
	}
};

export const fetchPosts = (params: {
	streamId: string;
	limit?: number;
	before?: string;
}) => async dispatch => {
	try {
		const response = await HostApi.instance.send(FetchPostsRequestType, params);
		dispatch(postsActions.addPostsForStream(params.streamId, response.posts));
		response.codemarks && dispatch(saveCodemarks(response.codemarks));
		return response;
	} catch (error) {
		logError(`There was an error fetching posts: ${error}`, params);
	}
};

export const fetchThread = (streamId: string, parentPostId: string) => async dispatch => {
	try {
		const { posts, codemarks } = await HostApi.instance.send(FetchPostRepliesRequestType, {
			streamId,
			postId: parentPostId
		});
		dispatch(postsActions.addPostsForStream(streamId, posts));
		codemarks && dispatch(saveCodemarks(codemarks));
		return posts;
	} catch (error) {
		logError(`There was an error fetching a thread: ${error}`, { parentPostId });
	}
};

// TODO: make this a capability? doesn't work on CS teams
export const closeDirectMessage = (streamId: string) => async dispatch => {
	try {
		const { stream } = await HostApi.instance.send(CloseStreamRequestType, { streamId });
		dispatch(streamActions.updateStream(stream));
	} catch (error) {
		logError(`There was an error closing a dm: ${error}`);
	}
};

export const openDirectMessage = (streamId: string) => async dispatch => {
	try {
		const response = await HostApi.instance.send(OpenStreamRequestType, { streamId });
		return dispatch(streamActions.updateStream(response.stream));
	} catch (error) {
		logError(`There was an error opening a dm: ${error}`);
	}
};

export const changeStreamMuteState = (streamId: string, mute: boolean) => async (
	dispatch,
	getState
) => {
	const mutedStreams = getState().preferences.mutedStreams || {};

	try {
		dispatch(updatePreferences({ mutedStreams: { ...mutedStreams, [streamId]: mute } }));
		await HostApi.instance.send(MuteStreamRequestType, { streamId, mute });
	} catch (error) {
		logError(`There was an error toggling stream mute state: ${error}`, { streamId });
		// TODO: communicate failure
		dispatch(updatePreferences({ mutedStreams: { ...mutedStreams, [streamId]: !mute } }));
	}
};

export const editCodemark = (codemarkId: string, attributes: {}) => async dispatch => {
	try {
		const response = await HostApi.instance.send(UpdateCodemarkRequestType, {
			codemarkId,
			...attributes
		});
		dispatch(updateCodemarks([response.codemark]));
	} catch (error) {
		logError(`failed to update codemark: ${error}`, { codemarkId });
	}
};

export const fetchCodemarks = () => async dispatch => {
	try {
		const response = await HostApi.instance.send(FetchCodemarksRequestType, {});
		if (response) dispatch(saveCodemarks(response.codemarks));
	} catch (error) {
		logError(`failed to fetch codemarks: ${error}`);
	}
};

export const setCodemarkStatus = (
	codemarkId: string,
	status: "closed" | "open"
) => async dispatch => {
	try {
		const response = await HostApi.instance.send(UpdateCodemarkRequestType, {
			codemarkId,
			status
		});
		dispatch(updateCodemarks([response.codemark]));
	} catch (error) {
		logError(`failed to change codemark status: ${error}`, { codemarkId });
	}
};

export const createServiceCard = async (attributes, codemark) => {
	let description = codemark.text + "\n\n";
	if (codemark.markers && codemark.markers.length > 0) {
		const marker = codemark.markers[0];
		description += "In " + marker.file + "\n\n```\n" + marker.code + "\n```\n\n";
	}
	description += "Posted via CodeStream";
	try {
		switch (attributes.provider) {
			case "jira": {
				return HostApi.instance.send(CreateJiraCardRequestType, {
					description,
					summary: codemark.title,
					issueType: attributes.issueType,
					project: attributes.boardId,
					assignees: attributes.assignees
				});
			}
			case "trello": {
				return HostApi.instance.send(TrelloCreateCardRequestType, {
					listId: attributes.listId,
					name: codemark.title,
					assignees: attributes.assignees,
					description
				});
			}
			case "github": {
				const response = await HostApi.instance.send(GitHubCreateCardRequestType, {
					description,
					title: codemark.title,
					repoName: attributes.boardName,
					assignees: attributes.assignees
				});
				return { url: response.html_url };
			}
			case "gitlab": {
				const response = await HostApi.instance.send(GitLabCreateCardRequestType, {
					description,
					title: codemark.title,
					repoName: attributes.boardName,
					assignee: attributes.assignees[0]
				});
				return { url: response.web_url };
			}
			case "asana": {
				const response = await HostApi.instance.send(AsanaCreateCardRequestType, {
					description,
					boardId: attributes.boardId,
					listId: attributes.listId,
					name: codemark.title,
					assignee: attributes.assignees[0]
				});
				return { url: response.data.url };
			}
			case "bitbucket": {
				return HostApi.instance.send(BitbucketCreateCardRequestType, {
					description,
					title: codemark.title,
					repoName: attributes.boardName,
					assignee: attributes.assignees[0]
				});
			}
		}
	} catch (error) {
		logError(`failed to create a ${attributes.service} card: ${error}`);
	}
};
