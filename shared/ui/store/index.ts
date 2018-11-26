import { applyMiddleware, createStore } from "redux";
import { composeWithDevTools } from "redux-devtools-extension";
import thunk from "redux-thunk";
import reducer from "../reducers";
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
