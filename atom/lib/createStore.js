import { createStore, applyMiddleware } from "redux";
import thunkMiddleware from "redux-thunk";
import { composeWithDevTools } from "redux-devtools-extension";
import reducer from "./reducers/reducer";

export default () => {
	const session = { accessToken: localStorage.getItem("codestream.accessToken") };
	return createStore(reducer, { session }, composeWithDevTools(applyMiddleware(thunkMiddleware)));
};
