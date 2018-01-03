import { createStore, applyMiddleware } from "redux";
import thunkMiddleware from "redux-thunk";
import { composeWithDevTools } from "redux-devtools-extension";
import reducer from "./reducers";
import pubnubMiddleWare from "./pubnub-middleware";
import db from "./local-cache";
import * as http from "./network-request";

export default (initialState = {}) => {
	return createStore(
		reducer,
		initialState,
		composeWithDevTools(
			applyMiddleware(thunkMiddleware.withExtraArgument({ db, http }), pubnubMiddleWare)
		)
	);
};
