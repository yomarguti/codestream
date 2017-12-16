import db from "../local-cache";

export const saveRepo = repo => dispatch => {
	return db.repos.put(repo).then(() => dispatch({ type: "ADD_REPO", payload: repo }));
};

export const saveRepos = repos => dispatch => {
	return db.repos.bulkPut(repos).then(() => dispatch({ type: "ADD_REPOS", payload: repos }));
};
