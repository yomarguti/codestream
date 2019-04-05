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
	HostDidChangeEditorSelectionNotificationType,
	HostDidChangeEditorVisibleRangesNotificationType,
	ShowCodemarkNotificationType,
	ShowStreamNotificationType,
	ShowCodemarkNotificationById
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
import { is } from "./utils";
import { getCodemark } from "./store/codemarks/reducer";

export { HostApi };

export function setupCommunication(host: { postMessage: (message: any) => void }) {
	Object.defineProperty(window, "acquireCodestreamHost", {
		value() {
			return host;
		}
	});
}

export async function initialize(selector: string) {
	const store = createCodeStreamStore(undefined, undefined, [
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

	listenForEvents(store);

	render(
		<Container store={store} i18n={{ locale: "en", messages: translations }} />,
		document.querySelector(selector)
	);

	const data = await HostApi.instance.send(BootstrapRequestType, {});
	await store.dispatch(actions.bootstrap(data) as any);

	HostApi.instance.notify(WebviewDidInitializeNotificationType, {});
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

	api.on(HostDidChangeActiveEditorNotificationType, params => {
		if (params.editor) {
			store.dispatch(
				actions.setEditorContext({
					textEditorUri: params.editor.uri,
					textEditorVisibleRanges: params.editor.visibleRanges,
					textEditorSelections: params.editor.selections,
					metrics: params.editor.metrics,
					textEditorLineCount: params.editor.lineCount
				})
			);
			store.dispatch(actions.setCurrentFile(params.editor.fileName));
		}
	});

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

	api.on(HostDidChangeEditorSelectionNotificationType, params => {
		store.dispatch(
			actions.setEditorContext({
				textEditorUri: params.uri,
				textEditorVisibleRanges: params.visibleRanges,
				textEditorSelections: params.selections,
				textEditorLineCount: params.lineCount
			})
		);
	});

	api.on(HostDidChangeEditorVisibleRangesNotificationType, params => {
		store.dispatch(
			actions.setEditorContext({
				textEditorUri: params.uri,
				textEditorVisibleRanges: params.visibleRanges,
				textEditorSelections: params.selections,
				textEditorLineCount: params.lineCount
			})
		);
	});

	api.on(ShowStreamNotificationType, ({ streamId, threadId }) => {
		store.dispatch(actions.setCurrentStream(streamId, threadId));
	});

	api.on(ShowCodemarkNotificationType, e => {
		const { codemarks, preferences } = store.getState();

		let codemarkId;
		if (is<ShowCodemarkNotificationById>(e, "codemarkId")) {
			codemarkId = e.codemarkId;
		} else {
			const codemarkKeybindings: { [key: string]: string } = preferences.codemarkKeybindings || {};
			codemarkId = codemarkKeybindings[e.codemarkIndex];
			if (codemarkId == null) return;
		}

		const codemark = getCodemark(codemarks, codemarkId);
		if (codemark == null) return;

		store.dispatch(actions.setCurrentStream(codemark.streamId, codemark.postId));
	});
}
