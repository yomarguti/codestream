import { upsert } from "../local-cache";
import { normalize } from "./utils";
import { saveMarkers } from "./marker";
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
	if (Array.isArray(attributes)) {
		return Promise.all(
			attributes.map(object => {
				return dispatch(saveMarkerLocations(object, isHistory));
			})
		);
	}

	const { streamId, teamId, commitHash, locations, dirty = {} } = attributes;

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
	const commitHash = context.currentCommit;
	const filePath = context.currentFile;

	if (!await gitRepo.isTracked(filePath)) {
		return;
	}

	// TODO we shouldn't have to ask the server every single time
	const { markers, markerLocations } = await http.get(
		`/markers?teamId=${teamId}&streamId=${streamId}&commitHash=${commitHash}`,
		session.accessToken
	);

	const locations = (markerLocations || {}).locations || {};
	const finder = new MarkerLocationFinder({
		filePath,
		gitRepo,
		http,
		accessToken: session.accessToken,
		teamId: context.currentTeamId,
		streamId
	});

	const missingMarkers = markers.filter(marker => !locations[marker._id]);
	if (missingMarkers.length) {
		logger.debug("Recalculating locations for", missingMarkers.length, "missing markers");
		const calculatedLocations = await finder.findLocationsForCurrentCommit(missingMarkers);
		Object.assign(locations, calculatedLocations);
	}

	const dirty = {};
	if (text !== undefined) {
		const bufferLocations = await finder.findLocationsForUncommittedChanges(locations, text);
		for (const markerId of Object.keys(bufferLocations)) {
			const bufferLocation = bufferLocations[markerId];
			const lastCommitLocation = locations[markerId];
			if (!areEqualLocations(bufferLocation, lastCommitLocation)) {
				dirty[markerId] = bufferLocation;
			}
		}

		const streamLocations = getState().markerLocations.byStream[streamId] || {};
		const uncommittedLocations = streamLocations.uncommitted || [];
		for (const uncommitted of uncommittedLocations) {
			const markerId = uncommitted.marker._id;
			const bufferLocations = await finder.findUpdatedLocations(
				{ [markerId]: uncommitted.location },
				filePath,
				uncommitted.bufferText,
				text
			);
			dirty[markerId] = bufferLocations[markerId];
		}
	}

	dispatch(saveMarkers(normalize(markers)));
	dispatch(saveMarkerLocations({ teamId, streamId, commitHash, locations, dirty }));
};

export const saveUncommittedLocations = ({
	post,
	markers,
	uncommittedLocations,
	filePath,
	bufferText
}) => async (dispatch, getState, { db }) => {
	const { streamId, teamId } = post;
	const uncommitted = [];
	for (let i = 0; i < markers.length; i++) {
		const marker = markers[i];
		const uncommittedLocation = uncommittedLocations[i];

		uncommitted.push({
			filePath,
			bufferText,
			marker,
			location: uncommittedLocation
		});
	}

	const primaryKey = Object.freeze({ streamId, teamId, commitHash: "uncommitted" });
	return db
		.transaction("rw", db.markerLocations, async () => {
			const record = await db.markerLocations.get(primaryKey);
			if (record) {
				await db.markerLocations.update(primaryKey, {
					...record,
					uncommitted: [...record.uncommitted, ...uncommitted]
				});
			} else {
				await db.markerLocations.add({
					...primaryKey,
					uncommitted
				});
			}
			return db.markerLocations.get(primaryKey);
		})
		.then(record =>
			dispatch({
				type: "ADD_UNCOMMITTED_LOCATIONS",
				payload: {
					streamId,
					uncommitted
				}
			})
		);
};

export const calculateUncommittedMarkers = () => async (dispatch, getState, { http, db }) => {
	const { context, repoAttributes, session, markerLocations } = getState();
	const { currentTeamId: teamId } = context;
	const gitRepo = await openRepo(repoAttributes.workingDirectory);
	const currentCommit = await gitRepo.getCurrentCommit();

	for (const streamId of Object.keys(markerLocations.byStream)) {
		const uncommittedLocations = markerLocations.byStream[streamId].uncommitted || [];
		for (const uncommitted of uncommittedLocations) {
			const { filePath, bufferText, marker, location } = uncommitted;
			const finder = new MarkerLocationFinder({
				filePath,
				gitRepo,
				http,
				accessToken: session.accessToken,
				teamId: context.currentTeamId,
				streamId
			});
			const commitLocations = await finder.backtrackLocationsAtCurrentCommit(
				{
					[marker._id]: location
				},
				bufferText
			);
			const commitLocation = commitLocations[marker._id];
			const meta = commitLocation[4] || {};

			// TODO implement cleanup policy to limit the number of old uncommitted locations
			if (!meta.startWasDeleted && !meta.endWasDeleted) {
				await http.put(
					"/marker-locations",
					{
						teamId,
						streamId,
						commitHash: currentCommit,
						locations: {
							[marker._id]: commitLocation
						}
					},
					session.accessToken
				);

				await http.put(
					"/markers/" + marker._id,
					{
						commitHashWhenCreated: currentCommit
					},
					session.accessToken
				);

				const primaryKey = Object.freeze({ streamId, teamId, commitHash: "uncommitted" });
				await db
					.transaction("rw", db.markerLocations, async () => {
						const record = await db.markerLocations.get(primaryKey);
						record.uncommitted = record.uncommitted.filter(
							uncommitted => uncommitted.marker._id != marker._id
						);
						await db.markerLocations.update(primaryKey, {
							...record,
							uncommitted: record.uncommitted.filter(
								uncommitted => uncommitted.marker._id != marker._id
							)
						});
					})
					.then(record =>
						dispatch({
							type: "REMOVE_UNCOMMITTED_LOCATION",
							payload: {
								streamId,
								markerId: marker._id
							}
						})
					);
			}
		}
	}
};
