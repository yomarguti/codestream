import { upsert } from "../local-cache";

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
