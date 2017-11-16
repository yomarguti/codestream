import { post } from "./network-request";

const getPath = route => `${atom.config.get("codestream.url")}${route}`;

export const User = {
	register(attributes) {
		return post(getPath("/no-auth/register"), attributes).then(({ user }) => user);
	},

	confirmEmail({ email, userId, code }) {
		const attributes = {
			email,
			userId,
			confirmationCode: code
		};
		return post(getPath("/no-auth/confirm"), attributes);
	}
};

export default {
	User
};
