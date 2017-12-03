import { combineReducers } from "redux";
import onboarding from "./onboarding";
import postsByStream from "./postsByStream";

const initialState = {
	currentFile: "",
	session: {},
	repo: undefined,
	repoMetadata: undefined,
	team: undefined
};

const reduceStreams = (state = [], { type, payload }) => {
	if (type === "ADD_STREAM") return [...state, action.payload];
	else return state;
};

const reduceUsers = (state = [], { type, payload }) => {
	if (type === "ADD_USER") return [...state, payload];
	return state;
};

const reduceSession = (state = {}, { type, payload }) => {
	if (type === "ADD_ACCESS_TOKEN") return { accessToken: payload };
	else return state;
};

const reduceRest = combineReducers({
	session: reduceSession,
	streams: reduceStreams,
	users: reduceUsers,
	onboarding,
	postsByStream
});
export default (state = initialState, action) => {
	if (action.type === "ACTIVE_FILE_CHANGED") return { ...state, currentFile: action.payload };
	if (action.type === "ADD_REPO_INFO") return { ...state, ...action.payload };
	else
		return {
			...state,
			...reduceRest(state, action)
		};
};
