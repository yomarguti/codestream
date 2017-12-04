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

export const bootstrapStore = store => {
	db
		.transaction("r", db.posts, db.users, db.streams, db.teams, db.repos, () => {
			db.users.limit(100).toArray(users => store.dispatch(bootstrapUsers(users)));
			db.repos.limit(100).toArray(repos => store.dispatch(bootstrapRepos(repos)));
			db.teams.limit(100).toArray(teams => store.dispatch(bootstrapTeams(teams)));
			db.posts.limit(300).toArray(posts => store.dispatch(bootstrapPosts(posts)));
			db.streams.limit(200).toArray(streams => store.dispatch(bootstrapStreams(streams)));
		})
		.catch(error => {
			debugger;
		});
};

const bootstrapUsers = payload => ({ type: "BOOTSTRAP_USERS", payload });
const bootstrapRepos = payload => ({ type: "BOOTSTRAP_REPOS", payload });
const bootstrapTeams = payload => ({ type: "BOOTSTRAP_TEAMS", payload });
const bootstrapPosts = payload => ({ type: "BOOTSTRAP_POSTS", payload });
const bootstrapStreams = payload => ({ type: "BOOTSTRAP_STREAMS", payload });
