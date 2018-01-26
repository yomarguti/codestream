import _ from "underscore-plus";
import { upsert } from "../local-cache";
import { normalize } from "./utils";
import { setUserPreference } from "./user";

export const saveStream = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "streams", attributes).then(stream => {
		dispatch({
			type: "ADD_STREAM",
			payload: stream
		});
	});
};

export const saveStreams = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "streams", attributes).then(streams =>
		dispatch({
			type: "ADD_STREAMS",
			payload: streams
		})
	);
};

export const fetchStreams = sortId => async (dispatch, getState, { http }) => {
	const { context, session } = getState();
	let url = `/streams?teamId=${context.currentTeamId}&repoId=${context.currentRepoId}`;
	if (sortId) url += `&lt=${sortId}`;

	return http.get(url, session.accessToken).then(({ streams, more }) => {
		const save = dispatch(saveStreams(normalize(streams)));
		if (more) return dispatch(fetchStreams(_.sortBy(streams, "sortId")[0].sortId));
		else return save;
	});
};

export const markStreamRead = streamId => async (dispatch, getState, { http }) => {
	const { session, context, streams } = getState();
	if (!streamId) return;
	if (context.currentFile === "") return;

	const markReadData = await http.put("/read/" + streamId, {}, session.accessToken);
	dispatch({ type: "CLEAR_UMI", payload: streamId });
	// console.log("READ THE STREAM", markReadData, session);
};

export const setStreamUMITreatment = (path, setting) => async (dispatch, getState) => {
	const { session, context, users } = getState();
	// FIXME -- we should save this info to the server rather than atom config
	let repo = atom.project.getRepositories()[0];
	let relativePath = repo.relativize(path);
	// console.log(repo);
	// atom.config.set("CodeStream.showUnread-" + relativePath, setting);
	let repoRoot = repo.getOriginURL();
	let prefPath = ["streamTreatments", repoRoot, relativePath];
	dispatch(setUserPreference(prefPath, setting));
	dispatch(recalculateUMI(true));
	return;
};

export const incrementUMI = post => async (dispatch, getState, { db }) => {
	const { session, context, users, streams } = getState();
	const currentUser = users[session.userId];

	// don't increment UMIs for posts you wrote yourself
	if (post.creatorId === session.userId) return;

	// don't increment the UMI of the current stream, presumably because you
	// see the post coming in. FIXME -- if we are not scrolled to the bottom,
	// we should still increment the UMI
	if (
		streams.byFile[context.currentFile] &&
		streams.byFile[context.currentFile].id === post.streamId
	)
		return;

	var hasMention = post.text.match("@" + currentUser.username + "\\b");
	let type = hasMention ? "INCREMENT_MENTION" : "INCREMENT_UMI";
	dispatch({
		type: type,
		payload: post.streamId
	});

	// if the user is up-to-date on this stream, then we need to create a pointer
	// to the first unread message in the stream, stored in lastReads
	if (!currentUser.lastReads[post.streamId]) {
		currentUser.lastReads[post.streamId] = post.id;

		return upsert(db, "users", currentUser).then(user =>
			dispatch({
				type: "UPDATE_USER",
				payload: user
			})
		);
	}
};

export const recalculateUMI = force => async (dispatch, getState, { http }) => {
	const { session, users, streams, posts } = getState();
	const currentUser = users[session.userId];

	// FIXME -- need all new posts as well

	let mentionRegExp = new RegExp("@" + currentUser.username + "\\b");

	let lastReads = currentUser.lastReads || {};
	let nextState = { mentions: {}, unread: {} };
	if (force) nextState.count = new Date().getTime();
	let streamsById = {};
	Object.keys(streams.byFile).forEach(key => {
		streamsById[streams.byFile[key].id] = streams.byFile[key];
	});
	Object.keys(lastReads).forEach(key => {
		let lastRead = lastReads[key];
		let unread = 0;
		let mentions = 0;
		if (lastRead) {
			// find the stream for key
			// then calculate the unread Messages
			let stream = streamsById[key];
			const postsForStream = _.sortBy(posts.byStream[key], "seqNum");

			if (!postsForStream) return;
			let postIds = postsForStream.map(post => {
				return post.id;
			});
			let index = postIds.indexOf(lastRead);
			let postsLength = postsForStream.length;
			for (let i = index; i < postsLength; i++) {
				unread++;
				let post = postsForStream[i];
				if (post && post.text && post.text.match(mentionRegExp)) {
					mentions++;
				}
			}
			if (unread) nextState.unread[key] = unread;
			if (mentions) nextState.mentions[key] = mentions;
		}
	});

	dispatch({
		type: "SET_UMI",
		payload: nextState
	});
};
