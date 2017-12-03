import { createStore, applyMiddleware } from "redux";
import thunkMiddleware from "redux-thunk";
import reducer from "./reducers/reducer";

export default () => {
	const session = { accessToken: localStorage.getItem("codestream.accessToken") };
	return createStore(reducer, { session }, applyMiddleware(thunkMiddleware));
};
