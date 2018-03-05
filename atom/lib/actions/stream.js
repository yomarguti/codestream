import _ from "underscore-plus";
import { upsert } from "../local-cache";
import { normalize } from "./utils";
import { setUserPreference } from "./user";
import { fetchAllPosts, fetchLatestPosts } from "./post";
import { getStreamsForRepo, getStreamForRepoAndFile } from "../reducers/streams";

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
		const normalizedStreams = normalize(streams);
		dispatch(fetchLatestPosts(normalizedStreams));
		const save = dispatch(saveStreams(normalizedStreams));
		if (more) return dispatch(fetchStreams(_.sortBy(streams, "sortId")[0].sortId));
		else return save;
	});
};

// FIXME: tech debt. this is only for use when starting with a clean local cache until
// the streams support lazy loading and infinite lists
export const fetchStreamsAndAllPosts = sortId => async (dispatch, getState, { http }) => {
	const { context, session } = getState();
	let url = `/streams?teamId=${context.currentTeamId}&repoId=${context.currentRepoId}`;
	if (sortId) url += `&lt=${sortId}`;

	return http.get(url, session.accessToken).then(({ streams, more }) => {
		const normalizedStreams = normalize(streams);
		dispatch(fetchAllPosts(normalizedStreams));
		const save = dispatch(saveStreams(normalizedStreams));
		if (more) return dispatch(fetchStreams(_.sortBy(streams, "sortId")[0].sortId));
		else return save;
	});
};

export const markStreamModified = (streamId, isModified) => async (
	dispatch,
	getState,
	{ http }
) => {
	const { context, session } = getState();
	if (context.currentFile === "" || !session.accessToken) return;

	// console.log("COMMENT THIS RETURN STATEMENT TO SAVE TO API SERVER");
	// return;

	// in the future, consider passing the deltas in the "editing" object
	let editing = isModified ? { commitHash: context.currentCommit } : false;

	let payload = {
		teamId: context.currentTeamId,
		repoId: context.currentRepoId,
		file: context.currentFile,
		streamId,
		editing
	};

	let markModifiedData = await http.put("/editing", payload, session.accessToken);
	// not sure we have to dispatch any action here, as we don’t intend to report on
	// whether you yourself have modified the file (other mechanisms exist for that in
	// the editor), so letting the API server know is all we need to do.
	// console.log("MODIFIED THE STREAM", markModifiedData, session);
};

export const markPathsModified = modifiedPaths => async (dispatch, getState, { http }) => {
	const { context, session, streams } = getState();

	if (!session.accessToken) return;

	let paths = [];
	let streamIds = [];
	modifiedPaths.forEach(path => {
		const stream = getStreamForRepoAndFile(streams, context.currentRepoId, path);
		if (stream) streamIds.push(stream.id);
		else paths.push(path);
	});

	let payload = {
		teamId: context.currentTeamId,
		repoId: context.currentRepoId,
		editing: {
			commitHash: context.currentCommit
		},
		files: paths || [],
		streamIds
	};

	// console.log("Marking all paths modified: ", payload);
	let markModifiedData = await http.put("/editing", payload, session.accessToken);
	// console.log("MODIFIED ALL PATHS", markModifiedData, session);
};
