import { combineReducers } from "redux";
import companies from "./companies";
import onboarding from "./onboarding";
import posts from "./posts";
import capabilities from "./capabilities";
import context from "./context";
import configs from "./configs";
import streams from "./streams";
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
import codemarks from "./codemarks";

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

const initialStartupProps = {
	startOnMainPanel: false,
	threadId: null
};
const startupProps = (state = initialStartupProps, action) => {
	return state;
};

const pluginVersion = (state = "", { type }) => {
	return state;
};

const appReducer = combineReducers({
	bootstrapped,
	capabilities,
	codemarks,
	companies,
	configs,
	connectivity,
	context,
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
	startupProps,
	streams,
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
