import "@babel/polyfill";
import { createStore, applyMiddleware } from "redux";
import { composeWithDevTools } from "redux-devtools-extension";
import thunk from "redux-thunk";
import Stream from "./Stream";
import reducer from "./reducers";
import WebviewApi from "./webview-api";
import EventEmitter from "./event-emitter";

export const createCodeStreamStore = (initialState = {}, thunkArg = {}, middleware) => {
	return createStore(
		reducer,
		initialState,
		composeWithDevTools(applyMiddleware(thunk.withExtraArgument(thunkArg), ...middleware))
	);
};

export { EventEmitter, Stream, WebviewApi, createCodeStreamStore as createStore };
