import { upsert } from "../local-cache";

export const saveMarkerLocations = attributes => (dispatch, getState, { db }) => {
	if (Object.keys(attributes).length === 0) return;
	return upsert(db, "markerLocations", attributes).then(record =>
		dispatch({ type: "ADD_MARKER_LOCATIONS", payload: record })
	);
};

export const markerDirtied = ({ markerId, streamId }, location) => (dispatch, getState, { db }) => {
	const { currentCommit, currentTeamId } = getState().context;
	const changes = {
		streamId,
		teamId: currentTeamId,
		commitHash: currentCommit,
		dirty: { [markerId]: location }
	};
	return upsert(db, "markerLocations", changes).then(record =>
		dispatch({
			type: "MARKER_DIRTIED",
			payload: record
		})
	);
};
};
