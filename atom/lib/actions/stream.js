import _ from "underscore-plus";
import { upsert } from "../local-cache";
import { normalize } from "./utils";
import { setUserPreference } from "./user";
import { fetchLatestPosts } from "./post";
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

export const fetchLatestForCurrentStream = sortId => async (dispatch, getState, { http }) => {
	const { context, session } = getState();
	let url = `/streams?teamId=${context.currentTeamId}&repoId=${context.currentRepoId}`;
	if (sortId) url += `&lt=${sortId}`;

	if (context.currentFile) {
		return http.get(url, session.accessToken).then(({ streams, more }) => {
			const normalizedStreams = normalize(streams);
			dispatch(saveStreams(normalizedStreams));

			const currentStream = normalizedStreams.find(stream => stream.file === context.currentFile);
			if (currentStream) return dispatch(fetchLatestPosts([currentStream]));
			else
				return dispatch(
					fetchLatestForCurrentStream(_.sortBy(normalizedStreams, "sortId")[0].sortId)
				);
		});
	}
};
