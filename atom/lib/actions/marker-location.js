import { upsert } from "../local-cache";

export const saveMarkerLocations = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "markerLocations", attributes)
		.then(locations => dispatch({ type: "ADD_MARKER_LOCATIONS", payload: locations }))
		.catch("DataError", () => {
			/* DataError is thrown when the primary key is not on the object.
				 Assuming that means it's an empty object, we can swallow this since it's no-op */
		});
};
