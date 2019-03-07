import { applyMiddleware, createStore } from "redux";
import { combineReducers } from "redux";
import { batchedSubscribe } from "redux-batched-subscribe";
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
import { reduceSession } from "../store/session/reducer";
import { reduceStreams } from "../store/streams/reducer";
import { reduceTeams } from "../store/teams/reducer";
import { reduceUnreads } from "../store/unreads/reducer";
import { reduceUsers } from "../store/users/reducer";
import { reduceDocumentMarkers } from "../store/documentMarkers/reducer";
import { debounceToAnimationFrame } from "../utils";
import middleware from "./middleware";
import { reduceEditorContext } from "./editorContext/reducer";

export { actions } from "./actions";

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
	documentMarkers: reduceDocumentMarkers,
	editorContext: reduceEditorContext,
	pluginVersion,
	posts: reducePosts,
	preferences: reducePreferences,
	repos: reduceRepos,
	route: reduceRoute,
	session: reduceSession,
	streams: reduceStreams,
	teams: reduceTeams,
	umis: reduceUnreads,
	users: reduceUsers,
	services: reduceServices
});

export function createCodeStreamStore(
	initialState: any = {},
	thunkArg: any = {},
	consumerMiddleware: any[] = []
) {
	return createStore(
		reducer,
		initialState,
		composeWithDevTools(
			applyMiddleware(thunk.withExtraArgument(thunkArg), ...middleware, ...consumerMiddleware),
			batchedSubscribe(debounceToAnimationFrame((notify: Function) => notify())) as any
		)
	);
}
