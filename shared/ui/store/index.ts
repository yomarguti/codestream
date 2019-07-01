import { applyMiddleware, createStore } from "redux";
import { combineReducers } from "redux";
import { batchedSubscribe } from "redux-batched-subscribe";
import { composeWithDevTools } from "redux-devtools-extension";
import thunk from "redux-thunk";
import { reduceCapabilities, CapabilitiesState } from "../store/capabilities/reducer";
import { reduceCodemarks } from "../store/codemarks/reducer";
import { reduceConfigs } from "../store/configs/reducer";
import { reduceConnectivity } from "../store/connectivity/reducer";
import { reduceContext } from "../store/context/reducer";
import { reduceProviders } from "../store/providers/reducer";
import { reducePosts } from "../store/posts/reducer";
import { reducePreferences } from "../store/preferences/reducer";
import { reduceRepos } from "../store/repos/reducer";
import { reduceServices } from "../store/services/reducer";
import { reduceSession } from "../store/session/reducer";
import { SessionState } from "../store/session/types";
import { reduceStreams } from "../store/streams/reducer";
import { reduceTeams } from "../store/teams/reducer";
import { reduceUnreads } from "../store/unreads/reducer";
import { reduceUsers } from "../store/users/reducer";
import { reduceDocumentMarkers } from "../store/documentMarkers/reducer";
import { debounceToAnimationFrame } from "../utils";
import middleware from "./middleware";
import { reduceEditorContext } from "./editorContext/reducer";
import { BootstrapActionType } from "./actions";
import { CodemarksState } from "./codemarks/types";
import { ConfigsState } from "./configs/types";
import { ConnectivityState } from "./connectivity/types";
import { ContextState } from "./context/types";
import { DocumentMarkersState } from "./documentMarkers/types";
import { EditorContextState } from "./editorContext/types";
import { PostsState } from "./posts/types";
import { PreferencesState } from "./preferences/types";
import { ReposState } from "./repos/types";
import { StreamsState } from "./streams/types";
import { TeamsState } from "./teams/types";
import { UnreadsState } from "./unreads/types";
import { UsersState } from "./users/types";
import { ServicesState } from "./services/types";
import { ProvidersState } from "./providers/types";

const reduceBootstrapped = (state = false, { type }) => {
	if (type === BootstrapActionType.Start) return false;
	if (type === BootstrapActionType.Complete) return true;
	return state;
};

const pluginVersion = (state = "", action) => {
	if (action.type === "@pluginVersion/Set") return action.payload;
	return state;
};

const reducer = combineReducers({
	bootstrapped: reduceBootstrapped,
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
	session: reduceSession,
	streams: reduceStreams,
	teams: reduceTeams,
	umis: reduceUnreads,
	users: reduceUsers,
	services: reduceServices,
	providers: reduceProviders
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

export interface CodeStreamState {
	bootstrapped: boolean;
	capabilities: CapabilitiesState;
	codemarks: CodemarksState;
	configs: ConfigsState;
	connectivity: ConnectivityState;
	context: ContextState;
	documentMarkers: DocumentMarkersState;
	editorContext: EditorContextState;
	pluginVersion: string;
	posts: PostsState;
	preferences: PreferencesState;
	repos: ReposState;
	session: SessionState;
	streams: StreamsState;
	teams: TeamsState;
	umis: UnreadsState;
	users: UsersState;
	services: ServicesState;
	providers: ProvidersState;
}
