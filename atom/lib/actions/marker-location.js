import { upsert } from "../local-cache";

export const saveMarkerLocations = attributes => (dispatch, getState, { db }) => {
	if (Object.keys(attributes).length === 0) return;
	return upsert(db, "markerLocations", attributes).then(record =>
		dispatch({ type: "ADD_MARKER_LOCATIONS", payload: record })
	);
};

export const markerDirtied = (id, location) => (dispatch, getState, { db }) => {
	const commitHash = getState().context.currentCommit;
	return db
		.transaction("rw", db.markerLocations, async () => {
			const locationObject = await db.markerLocations.get(commitHash);
			if (!locationObject.dirty) locationObject.dirty = {};
			locationObject.dirty[id] = location;
			await db.markerLocations.update(commitHash, { dirty: locationObject.dirty });
			return db.markerLocations.get(commitHash);
		})
		.then(locationObject =>
			dispatch({
				type: "MARKER_DIRTIED",
				payload: {
					markerId: id,
					streamId: locationObject.streamId,
					commitHash: locationObject.commitHash,
					location
				}
			})
		);
};
