import { get, post, put } from "../network-request";

export const createTeam = (store, attributes) => {
	const params = {
		url: attributes.url,
		firstCommitHash: attributes.firstCommitHash,
		team: {
			name: attributes.name
		}
	};
	return post("/repos", params, store.getState().accessToken).then(data => {
		store.setState({
			...store.getState(),
			...data
		});
		return data;
	});
};

export const addRepoForTeam = (store, attributes) => {
	return post("/repos", attributes, store.getState().accessToken).then(data => {
		store.setState({
			...store.getState(),
			...data
		});
	});
};

export const addMembers = (store, attributes) => {
	return post("/repos", attributes, store.getState().accessToken).then(data => {
		store.setState({
			...store.getState(),
			...data
		});
	});
};

export const getMembers = (store, teamId) => {
	return get(`/users?teamId=${teamId}`, store.getState().accessToken).then(data => data.users);
};

export default { createTeam, addMembers, getMembers, addRepoForTeam };
