import { upsert } from "../local-cache";
import { normalize } from "./utils";
import { saveMarkers } from "./marker";
import MarkerLocationFinder from "../git/MarkerLocationFinder";
import { open as openRepo } from "../git/GitRepo";
import rootLogger from "../util/Logger";

rootLogger.setLevel("trace");

const logger = rootLogger.forClass("actions/marker-location");

export const saveMarkerLocations = attributes => (dispatch, getState, { db }) => {
	if (Object.keys(attributes).length === 0) return;

	const { streamId, teamId, commitHash, locations } = attributes;
	const primaryKey = Object.freeze({ streamId, teamId, commitHash });
	return db
		.transaction("rw", db.markerLocations, async () => {
			const record = await db.markerLocations.get(primaryKey);
			if (record) {
				await db.markerLocations.update(primaryKey, {
					...record,
					locations: { ...record.locations, ...locations }
				});
			} else {
				await db.markerLocations.add(attributes);
			}
			return db.markerLocations.get(primaryKey);
		})
		.then(record => dispatch({ type: "ADD_MARKER_LOCATIONS", payload: record }));
};

export const markerDirtied = ({ markerId, streamId }, location) => (dispatch, getState, { db }) => {
	const { context } = getState();

	const primaryKey = Object.freeze({
		streamId,
		teamId: context.currentTeamId,
		commitHash: context.currentCommit
	});

	return db
		.transaction("rw", db.markerLocations, async () => {
			const record = await db.markerLocations.get(primaryKey);
			await db.markerLocations.update(primaryKey, {
				...record,
				dirty: { ...record.dirty, [markerId]: location }
			});
			return db.markerLocations.get(primaryKey);
		})
		.then(record =>
			dispatch({
				type: "MARKER_DIRTIED",
				payload: record
			})
		);
};

export const commitNewMarkerLocations = (oldCommitHash, newCommitHash) => (
	dispatch,
	getState,
	{ db, http }
) => {
	const { context, session } = getState();
	return db.transaction("rw", db.streams, db.markerLocations, () => {
		db.streams.where({ repoId: context.currentRepoId }).each(async stream => {
			const record = await db.markerLocations.get({
				streamId: stream.id,
				teamId: stream.teamId,
				commitHash: oldCommitHash
			});

			if (record) {
				const newRecord = {
					...record,
					commitHash: newCommitHash,
					locations: { ...record.locations, ...record.dirty },
					dirty: undefined
				};
				await http.put("/marker-locations", newRecord, session.accessToken);

				return upsert(db, "markerLocations", newRecord);
			}
		});
	});
};

export const refreshMarkersAndLocations = () => async (dispatch, getState, { http }) => {
	const { context, repoAttributes, session, streams } = getState();

	const stream = streams.byFile[context.currentFile];

	const { markers, markerLocations } = await http.get(
		`/markers?teamId=${context.currentTeamId}&streamId=${stream.id}&commitHash=${
			context.currentCommit
		}`,
		session.accessToken
	);
	logger.debug("Found", markers.length, "markers");

	const locations = markerLocations.locations || {};
	const markerLocationFinder = new MarkerLocationFinder(
		await openRepo(repoAttributes.workingDirectory),
		session,
		http,
		context,
		stream.id
	);

	const missingMarkers = markers.filter(marker => !locations[marker._id]);
	if (missingMarkers.length) {
		logger.debug("Recalculating locations for", missingMarkers.length, "missing markers");
		const calculatedLocations = markerLocationFinder.findLocations(missingMarkers);
		logger.debug("locations", calculatedLocations);
		Object.assign(locations, calculatedLocations);
	}

	await dispatch(saveMarkers(normalize(markers)));
	await dispatch(saveMarkerLocations({ ...normalize(markerLocations), locations }));
};
