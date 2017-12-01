import { get, post, put } from "../network-request";

export const createTeam = (store, attributes) => {
	const params = {
		url: attributes.url,
		firstCommitHash: attributes.firstCommitHash,
		team: {
			name: attributes.name
		}
	};
	return post("/repos", params, store.getViewData().accessToken).then(data => {
		store.addTeam(data);
		return data;
	});
};

export const addRepoForTeam = (store, attributes) => {
	return post("/repos", attributes, store.getViewData().accessToken).then(data => {
		store.addRepo(data);
	});
};

export const addMembers = (store, attributes) => {
	return post("/repos", attributes, store.getViewData().accessToken).then(data => {
		store.addMembers(data);
	});
};

export const getMembers = (store, teamId) => {
	// (store.getTeam(teamId)) return store.getTeam(teamId).members
	// else
	return get(`/users?teamId=${teamId}`, store.getViewData().accessToken).then(data => data.users);
};

export default { createTeam, addMembers, getMembers, addRepoForTeam };
