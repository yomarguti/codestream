import { ApiVersioningState } from "./apiVersioning/types";
import { applyMiddleware, createStore } from "redux";
import { combineReducers } from "redux";
import { batchedSubscribe } from "redux-batched-subscribe";
import { composeWithDevTools } from "redux-devtools-extension";
import thunk from "redux-thunk";
import { reduceApiVersioning } from "../store/apiVersioning/reducer";
import { reduceCapabilities, CapabilitiesState } from "../store/capabilities/reducer";
import { reduceCodemarks } from "../store/codemarks/reducer";
import { reduceConfigs } from "../store/configs/reducer";
import { reduceConnectivity } from "../store/connectivity/reducer";
import { reduceContext } from "../store/context/reducer";
import { reduceProviders } from "../store/providers/reducer";
import { reduceIde } from "./ide/reducer";
import { reducePosts } from "../store/posts/reducer";
import { reducePreferences } from "../store/preferences/reducer";
import { reduceRepos } from "../store/repos/reducer";
import { reduceServices } from "../store/services/reducer";
import { reduceSession } from "../store/session/reducer";
import { reduceVersioning } from "../store/versioning/reducer";
import { SessionState } from "../store/session/types";
import { reduceStreams } from "../store/streams/reducer";
import { reduceTeams } from "../store/teams/reducer";
import { reduceUnreads } from "../store/unreads/reducer";
import { reduceUsers } from "../store/users/reducer";
import { reduceDocumentMarkers } from "../store/documentMarkers/reducer";
import { debounceToAnimationFrame } from "../utils";
import middleware from "./middleware";
import { reduceEditorContext } from "./editorContext/reducer";
import { CodemarksState } from "./codemarks/types";
import { ConfigsState } from "./configs/types";
import { ConnectivityState } from "./connectivity/types";
import { ContextState } from "./context/types";
import { DocumentMarkersState } from "./documentMarkers/types";
import { EditorContextState } from "./editorContext/types";
import { IdeState } from "./ide/types";
import { PostsState } from "./posts/types";
import { PreferencesState } from "./preferences/types";
import { ReposState } from "./repos/types";
import { StreamsState } from "./streams/types";
import { TeamsState } from "./teams/types";
import { UnreadsState } from "./unreads/types";
import { UsersState } from "./users/types";
import { ServicesState } from "./services/types";
import { ProvidersState } from "./providers/types";
import { reduceBootstrapped } from "./bootstrapped/reducer";
import { VersioningState } from "./versioning/types";
import { ActiveIntegrationsState } from "./activeIntegrations/types";
import { reduceActiveIntegrations } from "./activeIntegrations/reducer";
import { reduceActivityFeed } from "./activityFeed/reducer";
import { ActivityFeedState } from "./activityFeed/types";
import { reduceFeatureFlags } from "./featureFlags/reducer";
import { FeatureFlagsState } from "./featureFlags/types";

const pluginVersion = (state = "", action) => {
	if (action.type === "@pluginVersion/Set") return action.payload;
	return state;
};

const reducer = combineReducers({
	activeIntegrations: reduceActiveIntegrations,
	activityFeed: reduceActivityFeed,
	bootstrapped: reduceBootstrapped,
	capabilities: reduceCapabilities,
	codemarks: reduceCodemarks,
	configs: reduceConfigs,
	connectivity: reduceConnectivity,
	context: reduceContext,
	documentMarkers: reduceDocumentMarkers,
	editorContext: reduceEditorContext,
	featureFlags: reduceFeatureFlags,
	ide: reduceIde,
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
	providers: reduceProviders,
	versioning: reduceVersioning,
	apiVersioning: reduceApiVersioning
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
	activeIntegrations: ActiveIntegrationsState;
	activityFeed: ActivityFeedState;
	bootstrapped: boolean;
	capabilities: CapabilitiesState;
	codemarks: CodemarksState;
	configs: ConfigsState;
	connectivity: ConnectivityState;
	context: ContextState;
	documentMarkers: DocumentMarkersState;
	editorContext: EditorContextState;
	featureFlags: FeatureFlagsState;
	ide: IdeState;
	pluginVersion: string;
	posts: PostsState;
	preferences: PreferencesState;
	providers: ProvidersState;
	repos: ReposState;
	session: SessionState;
	streams: StreamsState;
	teams: TeamsState;
	umis: UnreadsState;
	users: UsersState;
	services: ServicesState;
	versioning: VersioningState;
	apiVersioning: ApiVersioningState;
}
