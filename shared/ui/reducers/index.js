import { combineReducers } from "redux";
import companies from "./companies";
import onboarding from "./onboarding";
import posts from "./posts";
import capabilities from "./capabilities";
import { reduceContext } from "../store/context/reducer";
import configs from "./configs";
import { reduceStreams } from "../store/streams/reducer";
import users from "./users";
import repos from "./repos";
import teams from "./teams";
import markers from "./markers";
import markerLocations from "./marker-locations";
import umis from "./umis";
import messaging from "./messaging";
import connectivity from "./connectivity";
import currentPage from "./currentPage"; // TODO: remove this
import route from "./route";
import services from "./services";
import preferences from "./preferences";
import { reduceCodemarks } from "../store/codemarks/reducer";

const session = (state = {}, { type, payload }) => {
	switch (type) {
		case "RESET":
		case "CLEAR_SESSION":
			return {};
		case "INIT_SESSION":
			return payload;
		default:
			return state;
	}
};

const repoAttributes = (state = {}, { type, payload }) => {
	if (type === "SET_REPO_ATTRIBUTES") return payload;
	if (type === "SET_REPO_URL") return { ...state, url: payload };
	return state;
};

const bootstrapped = (state = false, { type }) => {
	if (type === "BOOTSTRAP_COMPLETE") return true;
	if (type === "RESET") return true;
	return state;
};

const pluginVersion = (state = "", { type }) => {
	return state;
};

const appReducer = combineReducers({
	bootstrapped,
	capabilities,
	codemarks: reduceCodemarks,
	companies,
	configs,
	connectivity,
	context: reduceContext,
	currentPage,
	markerLocations,
	markers,
	messaging,
	onboarding,
	pluginVersion,
	posts,
	preferences,
	repoAttributes,
	repos,
	route,
	session,
	streams: reduceStreams,
	teams,
	umis,
	users,
	services
});

export default (state, action) => {
	if (action.type === "RESET")
		state = {
			configs: state.configs,
			pluginVersion: state.pluginVersion,
			route: { route: "login" }
		};
	return appReducer(state, action);
};
