import Dexie from "dexie";

Dexie.debug = true;

const db = new Dexie("CodeStream");
db.version(1).stores({
	streams: "id, teamId, repoId",
	posts: "id, teamId, streamId, creatorId",
	repos: "id, teamId",
	users: "id, *teamIds, email, username",
	teams: "id, *memberIds"
});
db.version(2).stores({
	markers: "id, streamId, postId",
	markerLocations: "commitHash, streamId"
});

export default db;

export function upsert(db, tableName, changes) {
	return db.transaction("rw", tableName, () => {
		const table = db.table(tableName);
		const primaryKeyPath = table.schema.primKey.keyPath;

		if (Array.isArray(changes)) return bulkUpsert(table, primaryKeyPath, changes);
		return singleUpsert(table, primaryKeyPath, changes);
	});
}

export const bootstrapStore = store => {
	db
		.transaction(
			"r",
			db.posts,
			db.users,
			db.streams,
			db.teams,
			db.repos,
			db.markers,
			db.markerLocations,
			() => {
				db.users.limit(100).toArray(users => store.dispatch(bootstrapUsers(users)));
				db.repos.limit(100).toArray(repos => store.dispatch(bootstrapRepos(repos)));
				db.teams.limit(100).toArray(teams => store.dispatch(bootstrapTeams(teams)));
				db.posts.limit(300).toArray(posts => store.dispatch(bootstrapPosts(posts)));
				db.streams.limit(200).toArray(streams => store.dispatch(bootstrapStreams(streams)));
				db.markers.limit(300).toArray(markers => store.dispatch(bootstrapMarkers(markers)));
				db.markerLocations
					.limit(300)
					.toArray(locations => store.dispatch(bootstrapMarkerLocations(locations)));
			}
		)
		.then(() => {
			store.dispatch({ type: "BOOTSTRAP_COMPLETE" });
		})
		.catch(error => {
			console.error(error);
			// TODO: wtf
		});
};

const bootstrapUsers = payload => ({ type: "BOOTSTRAP_USERS", payload });
const bootstrapRepos = payload => ({ type: "BOOTSTRAP_REPOS", payload });
const bootstrapTeams = payload => ({ type: "BOOTSTRAP_TEAMS", payload });
const bootstrapPosts = payload => ({ type: "BOOTSTRAP_POSTS", payload });
const bootstrapStreams = payload => ({ type: "BOOTSTRAP_STREAMS", payload });
const bootstrapMarkers = payload => ({ type: "BOOTSTRAP_MARKERS", payload });
const bootstrapMarkerLocations = payload => ({ type: "BOOTSTRAP_MARKER_LOCATIONS", payload });

const bulkUpsert = (table, primaryKeyPath, changes) => {
	return Promise.all(changes.map(change => singleUpsert(table, primaryKeyPath, change)));
};

const singleUpsert = (table, primaryKeyPath, changes) => {
	const primaryKey = changes[primaryKeyPath];
	return table.get(primaryKey).then(async entity => {
		if (entity) {
			await table.update(primaryKey, changes);
		} else {
			await table.add(changes);
		}
		return table.get(primaryKey);
	});
};
