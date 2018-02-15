import { upsert } from "../local-cache";
import { normalize } from "./utils";
import { saveMarkers } from "./marker";
import { getStreamsForRepo } from "../reducers/streams";
import MarkerLocationFinder from "../git/MarkerLocationFinder";
import { open as openRepo } from "../git/GitRepo";
import { areEqualLocations } from "../util/Marker";
import rootLogger from "../util/Logger";

const logger = rootLogger.forClass("actions/marker-location");

export const saveMarkerLocations = (attributes, isHistory = false) => (
	dispatch,
	getState,
	{ db }
) => {
	const { streamId, teamId, commitHash, locations, dirty } = attributes;

	if (!(streamId && teamId && commitHash)) return;

	const primaryKey = Object.freeze({ streamId, teamId, commitHash });
	return db
		.transaction("rw", db.markerLocations, async () => {
			const record = await db.markerLocations.get(primaryKey);
			if (record) {
				await db.markerLocations.update(primaryKey, {
					...record,
					locations: { ...record.locations, ...locations },
					dirty
				});
			} else {
				await db.markerLocations.add(attributes);
			}
			return db.markerLocations.get(primaryKey);
		})
		.then(record =>
			dispatch({
				type: "ADD_MARKER_LOCATIONS",
				payload: record,
				isHistory
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

export const calculateLocations = ({ teamId, streamId, text }) => async (
	dispatch,
	getState,
	{ http }
) => {
	const { context, repoAttributes, session } = getState();
	const gitRepo = await openRepo(repoAttributes.workingDirectory);
	// TODO check if context.currentCommit is already updated at this point, so
	// we don't need to ask the repo
	const currentCommit = await gitRepo.getCurrentCommit();
	const commitHash = currentCommit.hash;

	// TODO we shouldn't have to ask the server every single time
	const { markers, markerLocations } = await http.get(
		`/markers?teamId=${teamId}&streamId=${streamId}&commitHash=${commitHash}`,
		session.accessToken
	);
	logger.debug("Found", markers.length, "markers");

	const locations = markerLocations.locations || {};
	const locationFinder = new MarkerLocationFinder({
		filePath: context.currentFile,
		gitRepo,
		http,
		accessToken: session.accessToken,
		teamId: context.currentTeamId,
		streamId
	});

	const missingMarkers = markers.filter(marker => !locations[marker._id]);
	if (missingMarkers.length) {
		logger.debug("Recalculating locations for", missingMarkers.length, "missing markers");
		const calculatedLocations = await locationFinder.findLocationsForCurrentCommit(missingMarkers);
		Object.assign(locations, calculatedLocations);
	}

	const dirty = await locationFinder.findLocationsForUncommittedChanges(locations, text);
	for (const markerId of Object.keys(dirty)) {
		const dirtyLocation = dirty[markerId];
		const lastCommitLocation = locations[markerId];
		if (areEqualLocations(dirtyLocation, lastCommitLocation)) {
			delete dirty[markerId];
		}
	}

	dispatch(saveMarkers(normalize(markers)));
	dispatch(saveMarkerLocations({ teamId, streamId, commitHash, locations, dirty }));
};

export const fetchMarkersAndLocations = ({ teamId, streamId }) => async (dispatch, getState) => {
	dispatch(calculateLocations({ teamId, streamId }));
};

export const refreshMarkersAndLocations = () => (dispatch, getState) => {
	const { context, streams } = getState();
	return Promise.all(
		Object.values(getStreamsForRepo(streams, context.currentRepoId) || {}).map(stream => {
			if (stream.teamId === context.currentTeamId)
				dispatch(calculateLocations({ streamId: stream.id, teamId: context.currentTeamId }));
		})
	);
};
