import { combineReducers } from "redux";
import onboarding from "./onboarding";
import postsByStream from "./postsByStream";
import context from "./context";

const streams = (state = [], { type, payload }) => {
	if (type === "ADD_STREAM") return [...state, payload];
	else return state;
};

const users = (state = [], { type, payload }) => {
	if (type === "ADD_USER") return [...state, payload];
	if (type === "ADD_USERS") return [...state, ...payload];
	if (type === "UPDATE_USER") return state.map(user => (user.id === payload.id ? payload : user));
	return state;
};

const teams = (state = [], { type, payload }) => {
	// is it naive to just replace the existing ones?
	if (type === "ADD_TEAMS") return payload;
	if (type === "ADD_TEAM") return [...state, payload];
	return state;
};

const repos = (state = [], { type, payload }) => {
	// is it naive to just replace the existing ones?
	if (type === "ADD_REPOS") return payload;
	if (type === "ADD_REPO") return [...state, payload];
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
