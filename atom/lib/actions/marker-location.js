import { upsert } from "../local-cache";

export const saveMarkerLocations = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "markerLocations", attributes)
		.then(locations => dispatch({ type: "ADD_MARKER_LOCATIONS", payload: locations }))
		.catch("DataError", () => {
			/* DataError is thrown when the primary key is not on the object.
				 Assuming that means it's an empty object, we can swallow this since it's no-op */
		});
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
