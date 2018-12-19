import { applyMiddleware, createStore } from "redux";
import { combineReducers } from "redux";
import { composeWithDevTools } from "redux-devtools-extension";
import thunk from "redux-thunk";
import { reduceCapabilities } from "../store/capabilities/reducer";
import { reduceCodemarks } from "../store/codemarks/reducer";
import { reduceConfigs } from "../store/configs/reducer";
import { reduceConnectivity } from "../store/connectivity/reducer";
import { reduceContext } from "../store/context/reducer";
import { reducePosts } from "../store/posts/reducer";
import { reducePreferences } from "../store/preferences/reducer";
import { reduceRepos } from "../store/repos/reducer";
import { reduceRoute } from "../store/route/reducer";
import { reduceServices } from "../store/services/reducer";
import { reduceStreams } from "../store/streams/reducer";
import { reduceTeams } from "../store/teams/reducer";
import { reduceUnreads } from "../store/unreads/reducer";
import { reduceUsers } from "../store/users/reducer";
import middleware from "./middleware";

export { actions } from "./actions";

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

const pluginVersion = (state = "") => state;

const reducer = combineReducers({
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

export const createCodeStreamStore = (
	initialState = {},
	thunkArg = {},
	consumerMiddleware = []
) => {
	return createStore(
		reducer,
		initialState,
		composeWithDevTools(
			applyMiddleware(thunk.withExtraArgument(thunkArg), ...middleware, ...consumerMiddleware)
		)
	);
};
