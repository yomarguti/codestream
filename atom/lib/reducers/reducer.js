import { combineReducers } from "redux";
import onboarding from "./onboarding";
import postsByStream from "./postsByStream";
import context from "./context";
import streams from "./streams";
import users from "./users";
import repos from "./repos";

const teams = (state = [], { type, payload }) => {
	// is it naive to just replace the existing ones?
	if (type === "ADD_TEAMS") return payload;
	if (type === "ADD_TEAM") return [...state, payload];
	return state;
};

const session = (state = {}, { type, payload }) => {
	if (type === "INIT_SESSION") return payload;
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
	postsByStream
});
