import "@babel/polyfill";
import Container from "./Container";
import {
	DidBlurNotificationType,
	DidChangeActiveEditorNotificationType,
	DidChangeConfigsNotificationType,
	DidChangeDataNotification,
	DidEstablishConnectivityNotificationType,
	DidFocusNotificationType,
	DidLoseConnectivityNotificationType,
	DidSignOutNotificationType
} from "./ipc/webview.protocol";
import { actions, createCodeStreamStore } from "./store";
import Stream from "./Stream";
import { HostApi } from "./webview-api";

export { actions, Container, Stream, HostApi, createCodeStreamStore as createStore };

// TODO: type up the store state
export function listenForEvents(store) {
	const api = HostApi.instance;

	api.on(DidChangeDataNotification, ({ type, data }) => {
		switch (type) {
			case "preferences":
				store.dispatch(actions.updatePreferences(data));
				break;
			case "unreads":
				store.dispatch(actions.updateUnreads(data));
				break;
			default:
				store.dispatch({ type: `ADD_${type.toUpperCase()}`, payload: data });
		}
	});

	api.on(DidChangeConfigsNotificationType, configs =>
		store.dispatch(actions.updateConfigs(configs))
	);

	api.on(DidLoseConnectivityNotificationType, () => store.dispatch(actions.offline()));
	api.on(DidEstablishConnectivityNotificationType, () => store.dispatch(actions.online()));

	api.on(
		DidChangeActiveEditorNotificationType,
		({ editor }) =>
			editor && store.dispatch(actions.setCurrentFile(editor.fileName, editor.fileStreamId))
	);

	api.on(DidFocusNotificationType, () => {
		setTimeout(() => {
			store.dispatch(actions.focus());
		}, 10); // we want the first click to go to the FocusTrap blanket
	});
	api.on(DidBlurNotificationType, () => {
		store.dispatch(actions.blur());
	});

	api.on(DidSignOutNotificationType, () => {
		store.dispatch(actions.reset());
	});
}
