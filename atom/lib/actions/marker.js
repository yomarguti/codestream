import db from "../local-cache";

export const saveMarker = marker => dispatch => {
	return db.markers.put(marker).then(() => dispatch({ type: "ADD_MARKER", payload: marker }));
};

export const saveMarkers = markers => dispatch => {
	return db.markers
		.bulkPut(markers)
		.then(() => dispatch({ type: "ADD_MARKERS", payload: markers }));
};
