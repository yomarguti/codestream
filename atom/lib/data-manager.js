export default class DataManager {
	session = {};
	data = {};
	listeners = [];
	users = [];
	teams = [];
	repos = [];
	streams = [];
	postsByStream = {};

	constructor(session = {}, createReducer) {
		this.session = session;
		this.reduce = createReducer(this.session, this.localCache);
		// LocalCache.init()
		// get data from LocalCache;
	}

	updateSession(payload) {
		this.session = { ...this.session, ...payload };
		this.publish();
	}

	getSession() {
		return this.session;
	}

	getViewData() {
		return {
			...this.session,
			...this.data,
			teams: this.teams,
			streams: this.streams,
			postsByStream: this.postsByStream,
			repos: this.repos
		};
	}

	subscribe(listener) {
		this.listeners.push(listener);
		return () => {
			this.listeners.splice(this.listeners.indexOf(listener), 1);
		};
	}

	publish() {
		this.listeners.forEach(l => l(this.getViewData()));
	}

	dispatch(action) {
		const { session, data } = this.reduce(action);
		this.session = session;
		this.data = data;
		this.publish();
	}

	addTeam({ team, users, repo }) {
		this.teams.push(team);
		this.users = this.users.concat(users);
		this.repos.push(repo);
		this.publish();
	}

	addRepo(data) {
		this.repos.push(data.repo);
		// handle updating the other things like users/teams
		this.publish();
	}

	addMembers(data) {
		this.users.push(data.users);
		this.publish();
	}

	upsertUser(user) {
		if (this.users.find(u => u.id === user.id)) return;
		this.users.push(user);
		this.publish();
	}

	upsertTeams(teams) {
		teams.forEach(team => {
			if (this.teams.find(t => t._id === team._id)) return;
			this.teams.push(team);
		});
		this.publish();
	}

	upsertRepos(repos) {
		repos.forEach(repo => {
			if (this.repos.find(r => r._id === repo._id)) return;
			this.repos.push(repo);
		});
		this.publish();
	}

	addStream(stream, posts) {
		this.streams.push(stream);
		this.postsByStream[stream._id] = posts;
		this.publish();
	}

	addPost(streamId, post) {
		this.postsByStream[streamId].push(post);
		this.publish();
	}

	updatePost(streamId, id, attributes) {
		const posts = this.postsByStream[streamId];
		this.postsByStream[streamId] = posts.map(post => {
			if (post._id === id) return attributes;
			else return post;
		});
		this.publish();
	}
}
