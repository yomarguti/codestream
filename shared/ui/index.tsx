import React from "react";
import { render } from "react-dom";
import Container from "./Container";
import {
	HostDidChangeActiveEditorNotificationType,
	HostDidChangeConfigNotificationType,
	HostDidChangeFocusNotificationType,
	HostDidLogoutNotificationType,
	WebviewDidInitializeNotificationType,
	HostDidChangeEditorSelectionNotificationType,
	HostDidChangeEditorVisibleRangesNotificationType,
	ShowCodemarkNotificationType,
	ShowStreamNotificationType,
	WebviewPanels
} from "./ipc/webview.protocol";
import { createCodeStreamStore } from "./store";
import { HostApi } from "./webview-api";
import {
	DidChangeConnectionStatusNotificationType,
	DidChangeDataNotificationType,
	DidChangeVersionCompatibilityNotificationType,
	ConnectionStatus,
	ChangeDataType,
	DidUpdateProvidersType,
	GetFileScmInfoRequestType,
	VersionCompatibility
} from "@codestream/protocols/agent";
import translations from "./translations/en";
import { getCodemark } from "./store/codemarks/reducer";
import { fetchCodemarks, openPanel } from "./Stream/actions";
import { ContextState } from "./store/context/types";
import { CodemarksState } from "./store/codemarks/types";
import { EditorContextState } from "./store/editorContext/types";
import { updateProviders } from "./store/providers/actions";
import { bootstrap, reset } from "./store/actions";
import { online, offline } from "./store/connectivity/actions";
import { upgradeRequired, upgradeRecommended } from "./store/versioning/actions";
import { updatePreferences } from "./store/preferences/actions";
import { updateUnreads } from "./store/unreads/actions";
import { updateConfigs } from "./store/configs/actions";
import { setEditorContext } from "./store/editorContext/actions";
import { blur, focus, setCurrentStream, setCurrentDocumentMarker } from "./store/context/actions";
import { isNotOnDisk } from "./utils";

export { HostApi };

export function setupCommunication(host: { postMessage: (message: any) => void }) {
	Object.defineProperty(window, "acquireCodestreamHost", {
		value() {
			return host;
		}
	});
}

export async function initialize(selector: string) {
	const store = createCodeStreamStore(undefined, undefined);

	listenForEvents(store);

	render(
		<Container store={store} i18n={{ locale: "en", messages: translations }} />,
		document.querySelector(selector)
	);

	await store.dispatch(bootstrap() as any);

	HostApi.instance.notify(WebviewDidInitializeNotificationType, {});
}

// TODO: type up the store state
export function listenForEvents(store) {
	const api = HostApi.instance;

	api.on(DidChangeConnectionStatusNotificationType, e => {
		if (e.status === ConnectionStatus.Reconnected) {
			store.dispatch(online());
		} else {
			store.dispatch(offline());
		}
	});

	api.on(DidChangeVersionCompatibilityNotificationType, e => {
		if (e.compatibility === VersionCompatibility.CompatibleUpgradeRecommended) {
			store.dispatch(upgradeRecommended());
		} else if (e.compatibility === VersionCompatibility.UnsupportedUpgradeRequired) {
			store.dispatch(upgradeRequired());
		}
	});

	api.on(DidChangeDataNotificationType, ({ type, data }) => {
		switch (type) {
			case ChangeDataType.Preferences:
				store.dispatch(updatePreferences(data));
				break;
			case ChangeDataType.Unreads:
				store.dispatch(updateUnreads(data as any)); // TODO: Not sure why we need the any here
				break;
			default:
				store.dispatch({ type: `ADD_${type.toUpperCase()}`, payload: data });
		}
	});

	api.on(DidUpdateProvidersType, ({ providers }) => {
		store.dispatch(updateProviders(providers));
	});

	api.on(HostDidChangeConfigNotificationType, configs => store.dispatch(updateConfigs(configs)));

	api.on(HostDidChangeActiveEditorNotificationType, async params => {
		let context: EditorContextState;
		if (params.editor) {
			context = {
				activeFile: params.editor.fileName,
				textEditorUri: params.editor.uri,
				textEditorVisibleRanges: params.editor.visibleRanges,
				textEditorSelections: params.editor.selections,
				metrics: params.editor.metrics,
				textEditorLineCount: params.editor.lineCount,
				scmInfo: isNotOnDisk(params.editor.uri)
					? undefined
					: await api.send(GetFileScmInfoRequestType, { uri: params.editor.uri })
			};
		} else {
			context = {
				activeFile: undefined,
				textEditorUri: undefined,
				textEditorSelections: [],
				textEditorVisibleRanges: [],
				scmInfo: undefined
			};
		}
		store.dispatch(setEditorContext(context));
	});

	api.on(HostDidChangeFocusNotificationType, ({ focused }) => {
		if (focused) {
			setTimeout(() => store.dispatch(focus()), 10); // we want the first click to go to the FocusTrap blanket
		} else {
			store.dispatch(blur());
		}
	});

	api.on(HostDidLogoutNotificationType, () => {
		store.dispatch(reset());
	});

	api.on(HostDidChangeEditorSelectionNotificationType, params => {
		store.dispatch(
			setEditorContext({
				textEditorUri: params.uri,
				textEditorVisibleRanges: params.visibleRanges,
				textEditorSelections: params.selections,
				textEditorLineCount: params.lineCount
			})
		);
	});

	api.on(HostDidChangeEditorVisibleRangesNotificationType, params => {
		store.dispatch(
			setEditorContext({
				textEditorUri: params.uri,
				textEditorVisibleRanges: params.visibleRanges,
				textEditorSelections: params.selections,
				textEditorLineCount: params.lineCount
			})
		);
	});

	api.on(ShowStreamNotificationType, ({ streamId, threadId }) => {
		store.dispatch(openPanel("main"));
		store.dispatch(setCurrentStream(streamId, threadId));
	});

	api.on(ShowCodemarkNotificationType, async e => {
		let {
			codemarks,
			context,
			editorContext
		}: {
			codemarks: CodemarksState;
			context: ContextState;
			editorContext: EditorContextState;
		} = store.getState();

		if (Object.keys(codemarks).length === 0) {
			await store.dispatch(fetchCodemarks());
			codemarks = store.getState().codemarks;
		}

		const codemark = getCodemark(codemarks, e.codemarkId);
		if (codemark == null) return;

		if (
			context.panelStack[0] === WebviewPanels.CodemarksForFile ||
			(e.sourceUri != null && editorContext.textEditorUri === e.sourceUri)
		) {
			store.dispatch(openPanel(WebviewPanels.CodemarksForFile));
			store.dispatch(setCurrentDocumentMarker(codemark.markerIds && codemark.markerIds[0]));
			return;
		}

		store.dispatch(openPanel(WebviewPanels.Codemarks));
		store.dispatch(setCurrentStream(codemark.streamId, codemark.postId));
	});
}
