import { combineReducers } from "redux";
import onboarding from "./onboarding";
import posts from "./posts";
import context from "./context";
import streams from "./streams";
import users from "./users";
import repos from "./repos";
import teams from "./teams";

const session = (state = {}, { type, payload }) => {
	if (type === "INIT_SESSION") return payload;
	if (type === "CLEAR_SESSION") return {};
	else return state;
};

const repoAttributes = (state = {}, { type, payload }) => {
	if (type === "SET_REPO_ATTRIBUTES") return payload;
	return state;
};

export default combineReducers({
	session,
	streams,
	users,
	teams,
	repos,
	context,
	repoAttributes,
	onboarding,
	posts
});
