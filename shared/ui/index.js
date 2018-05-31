import "@babel/polyfill";
import { createStore, applyMiddleware } from "redux";
import { composeWithDevTools } from "redux-devtools-extension";
import thunk from "redux-thunk";
import Post from "./components/Post";
import ComposeBox from "./components/ComposeBox";
import DateSeparator from "./components/DateSeparator";
import EditingIndicator from "./components/EditingIndicator";
import Stream from "./stream";
import reducer from "./reducers";
import WebviewIpc from "./webview-ipc";

export const createCodeStreamStore = (initialState = {}, thunkArg = {}, middleware) => {
	return createStore(
		reducer,
		initialState,
		composeWithDevTools(applyMiddleware(thunk.withExtraArgument(thunkArg), ...middleware))
	);
};

export {
	Post,
	DateSeparator,
	EditingIndicator,
	ComposeBox,
	Stream,
	WebviewIpc,
	createCodeStreamStore as createStore
};
