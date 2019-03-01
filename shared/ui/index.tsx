import React from "react";
import { render } from "react-dom";
import Container from "./Container";
import {
	HostDidChangeActiveEditorNotificationType,
	HostDidChangeConfigNotificationType,
	HostDidChangeFocusNotificationType,
	HostDidLogoutNotificationType,
	BootstrapRequestType,
	WebviewDidInitializeNotificationType,
	isSignedInBootstrap
} from "./ipc/webview.protocol";
import { actions, createCodeStreamStore } from "./store";
import { HostApi } from "./webview-api";
import {
	DidChangeConnectionStatusNotificationType,
	DidChangeDataNotificationType,
	ConnectionStatus,
	ChangeDataType
} from "@codestream/protocols/agent";
import translations from "./translations/en";

export { HostApi };

export function setupCommunication(host: { postMessage: (message: any) => void }) {
	Object.defineProperty(window, "acquireCodestreamHost", {
		value() {
			return host;
		}
	});
}

export async function initialize(selector: string, options: { prerender?: () => void }) {
	const data = await HostApi.instance.send(BootstrapRequestType, {});
	const state = isSignedInBootstrap(data)
		? {
				capabilities: data.capabilities,
				...(data.configs.email ? { route: { route: "login" } } : {}),
				context: {
					...data.context,
					hasFocus: true
					// currentTeamId: data.currentTeamId,
					// currentStreamId: data.currentStreamId,
					// threadId: data.currentThreadId,
					// textEditorVisibleRanges: data.visibleRanges,
					// textEditorUri: data.textEditorUri
				},
				pluginVersion: data.version,
				preferences: data.preferences,
				session: {
					userId: data.session.userId
				},
				umis: data.unreads
		  }
		: {
				pluginVersion: data.version,
				capabilities: data.capabilities,
				...(data.configs.email ? { route: { route: "login" } } : {}),
				context: {},
				session: {}
		  };

	const store = createCodeStreamStore(state, undefined, [
		store => {
			return next => action => {
				const oldState = store.getState();
				const result = next(action);

				console.groupCollapsed(action.type);
				console.debug(action);
				console.debug("old state", oldState);
				console.debug("new state", store.getState());
				console.groupEnd();

				return result;
			};
		}
	]);

	// TODO: should be able to include data.configs in call to createStore
	store.dispatch(actions.updateConfigs(data.configs || {}));

	listenForEvents(store);

	const doRender = () => {
		if (options.prerender !== undefined) {
			options.prerender();
		}

		render(
			<Container store={store} i18n={{ locale: "en", messages: translations }} />,
			document.querySelector(selector),
			() => HostApi.instance.notify(WebviewDidInitializeNotificationType, {})
		);
	};

	await store.dispatch(actions.bootstrap(data) as any);

	return doRender;
}

// TODO: type up the store state
export function listenForEvents(store) {
	const api = HostApi.instance;

	api.on(DidChangeConnectionStatusNotificationType, e => {
		if (e.status === ConnectionStatus.Reconnected) {
			store.dispatch(actions.online());
		} else {
			store.dispatch(actions.offline());
		}
	});

	api.on(DidChangeDataNotificationType, ({ type, data }) => {
		switch (type) {
			case ChangeDataType.Preferences:
				store.dispatch(actions.updatePreferences(data));
				break;
			case ChangeDataType.Unreads:
				store.dispatch(actions.updateUnreads(data as any)); // TODO: Not sure why we need the any here
				break;
			default:
				store.dispatch({ type: `ADD_${type.toUpperCase()}`, payload: data });
		}
	});

	api.on(HostDidChangeConfigNotificationType, configs =>
		store.dispatch(actions.updateConfigs(configs))
	);

	api.on(
		HostDidChangeActiveEditorNotificationType,
		({ editor }) =>
			editor &&
			store.dispatch(
				actions.setCurrentFile(
					editor.fileName,
					editor.fileStreamId,
					editor.visibleRanges,
					editor.uri
				)
			)
	);

	api.on(HostDidChangeFocusNotificationType, ({ focused }) => {
		if (focused) {
			setTimeout(() => store.dispatch(actions.focus()), 10); // we want the first click to go to the FocusTrap blanket
		} else {
			store.dispatch(actions.blur());
		}
	});

	api.on(HostDidLogoutNotificationType, () => {
		store.dispatch(actions.reset());
	});
}
