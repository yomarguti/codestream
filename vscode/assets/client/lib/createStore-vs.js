import { createStore, applyMiddleware } from "redux";
import thunkMiddleware from "redux-thunk";
import { composeWithDevTools } from "redux-devtools-extension";
// import Raven from "raven-js";
// import createRavenMiddleware from "raven-for-redux";
import reducer from "./reducers/index";
import rpcMiddleWare from "./rpc-middleware";
// import umiMiddleWare from "./umi-middleware";
// import contextualCommands from "./contextual-commands-middleware";
// import analyticsMiddleware from "./analytics-middleware";
// import presenceMiddleWare from "./presence-middleware";
// import db from "./local-cache";
import CodeStreamVSWebviewApi from "./codestream-api-vs-webview";

export default (initialState = {}) => {
	return createStore(
		reducer,
		initialState,
		composeWithDevTools(
			applyMiddleware(
				thunkMiddleware.withExtraArgument({ api: new CodeStreamVSWebviewApi() }),
				rpcMiddleWare
				// 		umiMiddleWare,
				// 		contextualCommands,
				// 		analyticsMiddleware,
				// 		presenceMiddleWare,
				// 		createRavenMiddleware(Raven, {
				// 			stateTransformer: ({ context, session, repoAttributes, messaging, onboarding }) => {
				// 				return {
				// 					context,
				// 					messaging,
				// 					onboarding,
				// 					repoAttributes,
				// 					session: { ...session, accessToken: Boolean(session.accessToken) }
				// 				};
				// 			},
				// 			getUserContext: ({ context, session, users }) => {
				// 				if (session.userId) {
				// 					const user = users[session.userId];
				// 					if (user.preferences.telemetryConsent) return user;
				// 				}
				// 			}
				// 		})
			)
		)
	);
};
