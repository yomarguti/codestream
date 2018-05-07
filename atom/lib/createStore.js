import { createStore, applyMiddleware } from "redux";
import thunkMiddleware from "redux-thunk";
import { composeWithDevTools } from "redux-devtools-extension";
import Raven from "raven-js";
import createRavenMiddleware from "raven-for-redux";
import reducer from "./reducers";
import pubnubMiddleWare from "./pubnub-middleware";
import umiMiddleWare from "./umi-middleware";
import contextualCommands from "./contextual-commands-middleware";
import analyticsMiddleware from "./analytics-middleware";
import presenceMiddleWare from "./presence-middleware";
import db from "./local-cache";
import * as http from "./network-request";

export default (initialState = {}) => {
	return createStore(
		reducer,
		initialState,
		composeWithDevTools(
			applyMiddleware(
				thunkMiddleware.withExtraArgument({ db, http }),
				pubnubMiddleWare,
				umiMiddleWare,
				contextualCommands,
				analyticsMiddleware,
				presenceMiddleWare,
				createRavenMiddleware(Raven, {
					stateTransformer: ({ context, session, repoAttributes, messaging, onboarding }) => {
						return {
							context,
							messaging,
							onboarding,
							repoAttributes,
							session: { ...session, accessToken: Boolean(session.accessToken) }
						};
					},
					getUserContext: ({ session, users }) => {
						if (session.userId) {
							const user = users[session.userId];
							if (user && user.preferences.telemetryConsent) return user;
						}
					}
				})
			)
		)
	);
};
