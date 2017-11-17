import { post } from "../network-request";

export const register = (store, attributes) => {
	return post("/no-auth/register", attributes).then(({ user, accessToken }) => {
		const { _id, ...rest } = user;
		const userObject = { id: _id, ...rest };
		store.setState({ accessToken, user: userObject });
		return userObject;
	});
};

export const confirmEmail = (store, attributes) => {
	return post("/no-auth/confirm", attributes).then(data => {
		store.setState(data);
		return { teams: data.teams, repos: data.repos };
	});
};

export const sendNewCode = (store, attributes) => {
	return post("/no-auth/register", attributes);
};

export default {
	register,
	confirmEmail,
	sendNewCode
};
