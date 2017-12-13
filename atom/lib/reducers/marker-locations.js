import { toMapBy } from "./utils";

const initialState = { byStream: {} };

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "BOOTSTRAP_MARKER_LOCATIONS": {
			const nextState = { byStream: {} };
			payload.forEach(locations => {
				const existingCommitsForStream = nextState.byStream[locations.streamId] || {};
				const existingLocationsForCommit = existingCommitsForStream[locations.commitHash] || {};
				nextState.byStream = {
					...nextState.byStream,
					[locations.streamId]: {
						...existingCommitsForStream,
						[locations.commitHash]: { ...existingLocationsForCommit, ...locations.locations }
					}
				};
			});
			return nextState;
		}
		case "ADD_MARKER_LOCATIONS": {
			const existingCommitsForStream = state.byStream[payload.streamId] || {};
			const existingLocationsForCommit = existingCommitsForStream[payload.commitHash] || {};
			return {
				byStream: {
					...state.byStream,
					[payload.streamId]: {
						...existingCommitsForStream,
						[payload.commitHash]: { ...existingLocationsForCommit, ...payload.locations }
					}
				}
			};
		}
		default:
			return state;
	}
};
