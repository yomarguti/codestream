import _ from "underscore-plus";
import { upsert } from "../local-cache";
import { normalize } from "./utils";
import { fetchAllPosts, fetchLatestPosts } from "./post";

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

export const fetchTeamStreams = (allPosts = false) => async (dispatch, getState) => {
	const { context } = getState();

	// fetch the file streams for this repo
	dispatch(fetchStreams(context.currentRepoId, allPosts));

	// fetch the team stream by passing "null" for the repo
	dispatch(fetchStreams(null, allPosts));
};

const fetchStreams = (repoId, allPosts, sortId) => async (dispatch, getState, { http }) => {
	const { context, session } = getState();
	let url = `/streams?teamId=${context.currentTeamId}`;
	if (repoId) url += `&repoId=${repoId}`;
	if (sortId) url += `&lt=${sortId}`;

	return http.get(url, session.accessToken).then(({ streams, more }) => {
		const normalizedStreams = normalize(streams);
		if (allPosts) dispatch(fetchAllPosts(normalizedStreams));
		else dispatch(fetchLatestPosts(normalizedStreams));
		const save = dispatch(saveStreams(normalizedStreams));
		if (more)
			return dispatch(fetchStreams(repoId, allPosts, _.sortBy(streams, "sortId")[0].sortId));
		else return save;
	});
};

// FIXME: tech debt. this is only for use when starting with a clean local cache until
// the streams support lazy loading and infinite lists
export const fetchTeamStreamsAndAllPosts = () => async (dispatch, getState, { http }) => {
	const { context, session } = getState();
	let url = `/streams?teamId=${context.currentTeamId}&repoId=${context.currentRepoId}`;

	return http.get(url, session.accessToken).then(({ streams, more }) => {
		const normalizedStreams = normalize(streams);
		dispatch(fetchAllPosts(normalizedStreams));
		const save = dispatch(saveStreams(normalizedStreams));
		if (more) return dispatch(fetchStreams(_.sortBy(streams, "sortId")[0].sortId));
		else return save;
	});
};
