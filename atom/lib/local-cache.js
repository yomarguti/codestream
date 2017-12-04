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

export default db;
