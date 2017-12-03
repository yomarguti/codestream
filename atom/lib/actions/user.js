import { post, put } from "../network-request";
import db from "../local-cache";

const addUser = user => dispatch => {
	db.users.add(user).then(() =>
		dispatch({
			type: "ADD_USER",
			payload: user
		})
	);
};

export const register = attributes => dispatch => {
	post("/no-auth/register", attributes)
		.then(({ user }) => {
			const { _id, ...rest } = user;
			const userObject = { id: _id, ...rest };
			dispatch(addUser(userObject));
			dispatch({ type: "SIGNUP_SUCCESS", payload: { ...attributes, userId: _id } });
			return userObject;
		})
		.catch(({ data }) => {
			if (data.code === "RAPI-1004")
				dispatch({
					type: "SIGNUP_EMAIL_EXISTS",
					payload: { email: attributes.email, alreadySignedUp: true }
				});
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
