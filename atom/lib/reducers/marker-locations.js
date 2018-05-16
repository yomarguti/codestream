const initialState = { byStream: {}, byCommit: {} };

const addLocation = (state, payload) => {
	if (payload.commitHash === "uncommitted") {
		return addUncommittedLocation(state, payload);
	} else {
		return addCommittedLocation(state, payload);
	}
};

const addLocationForCommit = (byCommit, payload) => {
	const existingLocations = byCommit[payload.commitHash] || {};
	return {
		...byCommit,
		[payload.commitHash]: {
			...existingLocations,
			...payload.locations,
			...payload.dirty
		}
	};
};

const addCommittedLocation = (state, payload) => {
	const byCommit = state.byStream[payload.streamId] || {};
	const existingLocations = byCommit[payload.commitHash] || {};
	return {
		byStream: {
			...state.byStream,
			[payload.streamId]: {
				...byCommit,
				[payload.commitHash]: {
					...existingLocations,
					...payload.locations,
					...payload.dirty
				}
			}
		},
		byCommit: addLocationForCommit(state.byCommit, payload)
	};
};

const addUncommittedLocation = (state, { streamId, uncommitted }) => {
	const byCommit = state.byStream[streamId] || {};
	const existingUncommitted = byCommit.uncommitted || [];
	return {
		byStream: {
			...state.byStream,
			[streamId]: {
				...byCommit,
				uncommitted: [...existingUncommitted, ...uncommitted]
			}
		}
	};
};

const removeUncommittedLocation = (state, { streamId, markerId }) => {
	const byCommit = state.byStream[streamId] || {};
	const uncommitted = byCommit.uncommitted || [];
	return {
		byStream: {
			...state.byStream,
			[streamId]: {
				...byCommit,
				uncommitted: uncommitted.filter(
					uncommittedLocation => uncommittedLocation.marker._id != markerId
				)
			}
		}
	};
};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "BOOTSTRAP_MARKER_LOCATIONS": {
			return payload.reduce(
				(nextState, location) => addLocation(nextState, location),
				initialState
			);
		}
		case "MARKERLOCATIONS-UPDATE_FROM_PUBNUB":
		case "ADD_MARKER_LOCATIONS":
			return addCommittedLocation(state, payload);
		case "ADD_UNCOMMITTED_LOCATIONS":
			return addUncommittedLocation(state, payload);
		case "REMOVE_UNCOMMITTED_LOCATION":
			return removeUncommittedLocation(state, payload);
		default:
			return state;
	}
};
