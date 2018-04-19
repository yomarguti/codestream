import { combineReducers } from "redux";
import companies from "./companies";
import onboarding from "./onboarding";
import posts from "./posts";
import context from "./context";
import streams from "./streams";
import users from "./users";
import repos from "./repos";
import teams from "./teams";
import markers from "./markers";
import markerLocations from "./marker-locations";
import umis from "./umis";
import messaging from "./messaging";
import connectivity from "./connectivity";
import currentPage from "./currentPage";

const session = (state = {}, { type, payload }) => {
	if (type === "INIT_SESSION") return payload;
	if (type === "CLEAR_SESSION") return {};
	else return state;
};

const repoAttributes = (state = {}, { type, payload }) => {
	if (type === "SET_REPO_ATTRIBUTES") return payload;
	if (type === "SET_REPO_URL") return { ...state, url: payload };
	return state;
};

const bootstrapped = (state = false, { type }) => {
	if (type === "BOOTSTRAP_COMPLETE") return true;
	return state;
};

const appReducer = combineReducers({
	bootstrapped,
	companies,
	connectivity,
	context,
	currentPage,
	markerLocations,
	markers,
	messaging,
	onboarding,
	posts,
	repoAttributes,
	repos,
	session,
	streams,
	teams,
	umis,
	users
});

export default (state, action) => {
	if (action.type === "RESET") state = undefined;
	return appReducer(state, action);
};
