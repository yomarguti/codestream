import { post, put } from "../network-request";

export const register = (store, attributes) => {
	return post("/no-auth/register", attributes).then(({ user, accessToken }) => {
		const { _id, ...rest } = user;
		const userObject = { id: _id, ...rest };
		store.updateSession({ accessToken });
		store.addUser(userObject);
		return userObject;
	});
};

export const confirmEmail = (store, attributes) => {
	return post("/no-auth/confirm", attributes).then(data => {
		store.upsertUser(data.user);
		return { teams: data.teams, repos: data.repos };
	});
};

export const sendNewCode = (store, attributes) => {
	return post("/no-auth/register", attributes);
};

export const authenticate = async (store, attributes) => {
	const { accessToken, user, teams, repos } = await put("/no-auth/login", attributes);
	store.updateSession({ accessToken });
	store.upsertUser(user);
	store.upsertTeams(teams);
	store.upsertRepos(repos);
};

export default {
	register,
	confirmEmail,
	sendNewCode,
	authenticate
};
