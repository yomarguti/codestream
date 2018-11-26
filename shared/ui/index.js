import "@babel/polyfill";
import Container from "./Container";
import Stream from "./Stream";
import WebviewApi from "./webview-api";
import EventEmitter from "./event-emitter";
import * as miscActions from "./actions";
import * as contextActions from "./store/context/actions";
import { createCodeStreamStore } from "./store";

export { createCodeStreamStore };

const actions = { ...miscActions, ...contextActions };

export {
	actions,
	Container,
	EventEmitter,
	Stream,
	WebviewApi,
	createCodeStreamStore as createStore
};
