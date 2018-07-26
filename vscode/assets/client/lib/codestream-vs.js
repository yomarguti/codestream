import "resize-observer";
import React from "react";
import ReactDOM from "react-dom";
import "resize-observer";
import { Container, createStore, EventEmitter, WebviewApi } from "codestream-components";
import translations from "codestream-components/translations/en.json";
import loggingMiddleWare from "./logging-middleware";

const data = window.bootstrap;

const store = createStore(
	{
		startOnMainPanel: Boolean(data.currentStreamId),
		context: {
			currentTeamId: data.currentTeamId,
			currentStreamId: data.currentStreamId
		},
		session: {
			userId: data.currentUserId
		}
	},
	{ api: new WebviewApi() },
	[loggingMiddleWare]
);

EventEmitter.on("data", ({ type, payload }) => {
	store.dispatch({ type: `ADD_${type.toUpperCase()}`, payload });
});

EventEmitter.on("interaction:focus", () => {
	// TODO
});
EventEmitter.on("interaction:blur", () => {
	// TODO
});

if (data.currentUserId) {
	store.dispatch({ type: "BOOTSTRAP_USERS", payload: data.users });
	store.dispatch({ type: "BOOTSTRAP_REPOS", payload: data.repos });
	store.dispatch({ type: "BOOTSTRAP_TEAMS", payload: data.teams });
	store.dispatch({ type: "BOOTSTRAP_STREAMS", payload: data.streams });
}
store.dispatch({ type: "BOOTSTRAP_COMPLETE" });

ReactDOM.render(
	<Container store={store} i18n={{ locale: "en", messages: translations }} />,
	document.querySelector("#app")
);
