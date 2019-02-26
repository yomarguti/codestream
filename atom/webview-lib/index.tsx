import * as React from "react";
import * as ReactDOM from "react-dom";
import {
	actions,
	Container,
	createStore,
	HostApi,
	listenForEvents,
	englishLocale,
} from "@codestream/webview";
import {
	GetViewBootstrapDataRequestType,
	JoinLiveShareRequestType,
	WebviewReadyNotificationType,
} from "@codestream/protocols/webview";

const start = Date.now();

window.addEventListener("message", message => {
	Object.defineProperty(window, "acquireCodestreamHost", {
		value() {
			return message.ports[0];
		},
	});

	const { styles } = message.data;

	styles.forEach((stylesheet: string) => {
		const style = document.createElement("style");
		style.innerText = stylesheet;
		document.head.appendChild(style);
	});

	launch();
});

async function launch() {
	const api = HostApi.instance;

	let data: any = await api.send(GetViewBootstrapDataRequestType, undefined); // TODO: data: GetViewBootstrapDataResponse
	const store = createStore({
		pluginVersion: data.version,
		context: {
			...(data.context || {}),
			currentTeamId: data.currentTeamId,
			currentStreamId: data.currentStreamId,
			threadId: data.currentThreadId,
			hasFocus: true,
		},
		session: {
			userId: data.currentUserId,
		},
		umis: data.unreads,
		preferences: data.preferences,
		capabilities: data.capabilities,
		...(data.configs.email ? { route: { route: "login" } } : {}),
	});

	// TODO: should be able to include data.configs in call to createStore
	store.dispatch(actions.updateConfigs(data.configs || {}));

	listenForEvents(store);

	const render = () => {
		setTimeout(() => {
			document.body.classList.remove("preload");
		}, 1000); // Wait for animations to complete
		ReactDOM.render(
			<Container store={store} i18n={{ locale: "en", messages: englishLocale }} />,
			document.querySelector("#app"),
			() => api.send(WebviewReadyNotificationType, undefined)
		);
	};

	const vslsUrlRegex = /https:\/\/insiders\.liveshare\.vsengsaas\.visualstudio\.com\/join\?/;

	document.body.addEventListener(
		"click",
		function(e) {
			if (e == null || e.target == null || (e.target as HTMLElement).tagName !== "A") return;

			if (!vslsUrlRegex.test((e.target as HTMLAnchorElement).href)) return;

			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();

			api.send(JoinLiveShareRequestType, {
				url: (e.target as HTMLAnchorElement).href,
			});
		},
		true
	);

	store.dispatch((actions.bootstrap as any)(data)).then(() => {
		const duration = Date.now() - start;
		if (duration < 250) {
			setTimeout(render, 250 - duration);
		} else {
			render();
		}
	});
}
