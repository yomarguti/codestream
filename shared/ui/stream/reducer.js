import _ from 'underscore'

const initialState = {
	byTeam: {
		//[teamId]: { [streamId]: {} }
	},
	byRepo: {
		//[repoId]: { byFile: {} }
	}
};

const addStreamForTeam = (state, stream) => {
	const teamId = stream.teamId;
	const teamStreams = state[teamId] || {};
	return {
		...state,
		[teamId]: { ...teamStreams, [stream.id]: stream }
	};
};

const addStream = (state, stream) => {
	const existingStreamsForRepo = state.byRepo[stream.repoId] || { byFile: {}, byId: {} };
	return {
		byTeam: addStreamForTeam(state.byTeam, stream),
		byRepo: {
			...state.byRepo,
			[stream.repoId]: {
				byFile: {
					...existingStreamsForRepo.byFile,
					[stream.file]: stream
				},
				byId: {
					...existingStreamsForRepo.byId,
					[stream.id]: stream
				}
			}
		}
	};
};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "ADD_STREAMS":
		case "BOOTSTRAP_STREAMS":
			return payload.reduce(addStream, state);
		case "STREAMS-UPDATE_FROM_PUBNUB":
		case "ADD_STREAM":
			return addStream(state, payload);
		default:
			return state;
	}
};

// Selectors
export const getStreamForTeam = (state, teamId) => {
	const streams = state.byTeam[teamId] || {};
	return Object.values(streams).find(stream => stream.isTeamStream && stream.name === "general");
};

export const getStreamForRepoAndFile = (state, repoId, file) => {
	const filesForRepo = (state.byRepo[repoId] || {}).byFile;
	if (filesForRepo) return filesForRepo[file];
};

export const getStreamsByFileForRepo = (state, repoId) => {
	return (state.byRepo[repoId] || {}).byFile;
};

export const getStreamsByIdForRepo = (state, repoId) => {
	return (state.byRepo[repoId] || {}).byId;
};

// If stream for a pending post is created, the pending post will be lost (not displayed)
// TODO: reconcile pending posts for a file with stream when the stream is created
export const getPostsForStream = ({ byStream, pending }, streamId = "") => {
	if (streamId === "") return [];
	const pendingForStream = pending.filter(it => {
		try {
			return it.streamId === streamId || it.stream.file === streamId;
		} catch (e) {
			return false;
		}
	});
	return [..._.sortBy(byStream[streamId], "seqNum"), ...pendingForStream];
};
