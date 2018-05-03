import "@babel/polyfill";
import React from "react";
import ReactDOM from "react-dom";
import { addLocaleData, IntlProvider } from "react-intl";
import { Provider } from "react-redux";
import en from "react-intl/locale-data/en";
import CodeStreamRoot from "./components/VSCodeStreamRoot";
import copy from "../translations/en.js";
import createStore from "./createStore-vs";
import VSCodeAPI from "./VSCodeAPI";

addLocaleData([...en]);

const data = JSON.parse(document.querySelector("#data").textContent);

const store = (window.store = createStore({
	context: {
		currentTeamId: data.currentTeamId,
		currentRepoId: data.currentRepoId,
		currentStreamId: data.currentStreamId,
		currentFile: data.currentFile,
		currentStreamLabel: data.currentStreamLabel,
		currentStreamServiceType: data.currentStreamServiceType
	},
	ipcInteractions: {
		selectedPostId: data.selectedPostId
	},
	session: {
		userId: data.currentUserId
	}
}));

store.dispatch({ type: "BOOTSTRAP_USERS", payload: data.users });
store.dispatch({ type: "BOOTSTRAP_REPOS", payload: data.repos });
store.dispatch({ type: "BOOTSTRAP_TEAMS", payload: data.teams });
store.dispatch({ type: "BOOTSTRAP_POSTS", payload: data.posts });
store.dispatch({ type: "BOOTSTRAP_STREAMS", payload: data.streams });
store.dispatch({ type: "BOOTSTRAP_COMPLETE" });

console.log("store", store.getState());

ReactDOM.render(
	<IntlProvider locale="en" messages={copy}>
		<Provider store={store}>
			<CodeStreamRoot platform={VSCodeAPI} repositories={[]} />
		</Provider>
	</IntlProvider>,
	document.querySelector("#app")
);
