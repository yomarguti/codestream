import { post } from "../network-request";

export const register = (store, attributes) => {
	return post("/no-auth/register", attributes).then(({ user, accessToken }) => {
		store.setState({ accessToken, user });
		return user;
	});
};

export const confirmEmail = (store, attributes) => {
	return post("/no-auth/confirm", attributes);
};

export default {
	register,
	confirmEmail
};
