import _ from "underscore-plus";
import { upsert } from "../local-cache";
import { normalize } from "./utils";
import { fetchAllPosts, fetchLatestPosts } from "./post";
import { setCurrentStream } from "./context";

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

export const createStream = attributes => async (dispatch, getState, { http }) => {
	const { context, session } = getState();

	const stream = {
		teamId: context.currentTeamId,
		type: attributes.type
	};
	if (attributes.type === "channel") {
		stream.name = attributes.name;
		stream.privacy = attributes.privacy;
	}
	if (attributes.memberIds) {
		stream.memberIds = attributes.memberIds;
	}
	try {
		const data = await http.post("/streams", stream, session.accessToken);
		let streams = data.streams || [];
		if (data.stream) {
			streams.push(data.stream);
			dispatch(setCurrentStream(data.stream._id));
		}
		if (streams.length > 0) dispatch(saveStreams(normalize(streams)));
	} catch (error) {
		if (http.isApiRequestError(error)) {
			Raven.captureMessage(error.data.message, {
				logger: "actions/stream",
				extra: { error: error.data }
			});
		}
		// TODO: different types of errors?
	}
};

// update a stream with some new attributes, for example changing the name of the stream
export const updateStream = (streamId, newAttributes) => async (dispatch, getState, { http }) => {
	const { context, session } = getState();

	try {
		const data = await http.post("/streams/" + streamId, newAttributes, session.accessToken);
		let streams = data.streams || [];
		if (data.stream) data.streams.push(data.stream);
		if (streams.length > 0) dispatch(saveStreams(normalize(streams)));
	} catch (error) {
		if (http.isApiRequestError(error)) {
			Raven.captureMessage(error.data.message, {
				logger: "actions/stream",
				extra: { error: error.data }
			});
		}
		// TODO: different types of errors?
	}
};

// FIXME if the user leaving the stream is me, we need to remove it from our store
export const removeUserFromStream = (streamId, userId) => async (dispatch, getState, { http }) => {
	const { context, session } = getState();

	const update = {
		$pull: { memberIds: userId }
	};

	try {
		const data = await http.put("/streams/" + streamId, update, session.accessToken);
		let streams = data.streams || [];
		if (data.stream) data.streams.push(data.stream);
		if (streams.length > 0) dispatch(saveStreams(normalize(streams)));
	} catch (error) {
		if (http.isApiRequestError(error)) {
			Raven.captureMessage(error.data.message, {
				logger: "actions/stream",
				extra: { error: error.data }
			});
		}
		// TODO: different types of errors?
	}
};

export const addUserToStream = (streamId, userId) => async (dispatch, getState, { http }) => {
	const { context, session } = getState();

	const update = {
		$push: { memberIds: userId }
	};

	try {
		const data = await http.put("/streams/" + streamId, update, session.accessToken);
		let streams = data.streams || [];
		if (data.stream) data.streams.push(data.stream);
		if (streams.length > 0) dispatch(saveStreams(normalize(streams)));
	} catch (error) {
		if (http.isApiRequestError(error)) {
			Raven.captureMessage(error.data.message, {
				logger: "actions/stream",
				extra: { error: error.data }
			});
		}
		// TODO: different types of errors?
	}
};

export const joinStream = streamId => async (dispatch, getState, { http }) => {
	const { context, session } = getState();

	try {
		const data = await http.put("/join/" + streamId, {}, session.accessToken);
		let streams = data.streams || [];
		if (data.stream) data.streams.push(data.stream);
		if (streams.length > 0) dispatch(saveStreams(normalize(streams)));
	} catch (error) {
		if (http.isApiRequestError(error)) {
			Raven.captureMessage(error.data.message, {
				logger: "actions/stream",
				extra: { error: error.data }
			});
		}
		// TODO: different types of errors?
	}
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
