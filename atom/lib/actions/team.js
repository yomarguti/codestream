import { post, put } from "../network-request";

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
	});
};

export default { createTeam };
