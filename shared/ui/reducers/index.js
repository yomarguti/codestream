import { combineReducers } from "redux";
import { reducePosts } from "../store/posts/reducer";
import { reduceCapabilities } from "../store/capabilities/reducer";
import { reduceContext } from "../store/context/reducer";
import { reduceConfigs } from "../store/configs/reducer";
import { reduceStreams } from "../store/streams/reducer";
import { reduceUsers } from "../store/users/reducer";
import { reduceRepos } from "../store/repos/reducer";
import { reduceTeams } from "../store/teams/reducer";
import { reduceUnreads } from "../store/unreads/reducer";
import { reduceConnectivity } from "../store/connectivity/reducer";
import { reduceRoute } from "../store/route/reducer";
import { reduceServices } from "../store/services/reducer";
import { reducePreferences } from "../store/preferences/reducer";
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
	capabilities: reduceCapabilities,
	codemarks: reduceCodemarks,
	configs: reduceConfigs,
	connectivity: reduceConnectivity,
	context: reduceContext,
	pluginVersion,
	posts: reducePosts,
	preferences: reducePreferences,
	repos: reduceRepos,
	route: reduceRoute,
	session,
	streams: reduceStreams,
	teams: reduceTeams,
	umis: reduceUnreads,
	users: reduceUsers,
	services: reduceServices
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
