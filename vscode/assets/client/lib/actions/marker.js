import { upsert } from "../local-cache";

export const saveMarker = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "markers", attributes).then(marker =>
		dispatch({ type: "ADD_MARKER", payload: marker })
	);
};

export const saveMarkers = markers => ({ type: "ADD_MARKERS", payload: markers });
