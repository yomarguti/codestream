import "@babel/polyfill";
import { createStore, applyMiddleware } from "redux";
import { composeWithDevTools } from "redux-devtools-extension";
import thunk from "redux-thunk";
import Container from "./Container";
import Stream from "./Stream";
import reducer from "./reducers";
import WebviewApi from "./webview-api";
import EventEmitter from "./event-emitter";
import * as miscActions from "./actions";
import * as contextActions from "./actions/context";
import middleware from "./middleware";

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

const actions = { ...miscActions, ...contextActions };

export {
	actions,
	Container,
	EventEmitter,
	Stream,
	WebviewApi,
	createCodeStreamStore as createStore
};
