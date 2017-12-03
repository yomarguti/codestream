import { createStore, applyMiddleware } from "redux";
import thunkMiddleware from "redux-thunk";
import { composeWithDevTools } from "redux-devtools-extension";
import reducer from "./reducers/reducer";

export default () => {
	const accessToken = localStorage.getItem("codestream.accessToken");
	const session = accessToken === "undefined" ? {} : { accessToken };
	return createStore(reducer, { session }, composeWithDevTools(applyMiddleware(thunkMiddleware)));
};
