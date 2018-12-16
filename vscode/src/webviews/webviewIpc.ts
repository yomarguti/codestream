"use strict";
import * as path from "path";
import { TextEditor, Uri, WebviewPanel, workspace } from "vscode";
import { StreamThread } from "../api/session";
import { Container } from "../container";
import { Logger } from "../logger";
import { CodeStreamWebviewPanel } from "./webviewPanel";

export enum WebviewIpcMessageType {
	didBlur = "codestream:interaction:blur",
	didChangeActiveEditor = "codestream:interaction:active-editor-changed",
	didChangeConfiguration = "codestream:configs",
	didChangeData = "codestream:data",
	didChangePreferences = "codestream:data:preferences",
	didChangeStreamThread = "codestream:interaction:stream-thread-selected",
	didChangeUnreads = "codestream:data:unreads",
	didConnect = "codestream:connectivity:online",
	didDisconnect = "codestream:connectivity:offline",
	didFileChange = "codestream:publish:file-changed",
	didFocus = "codestream:interaction:focus",
	didSelectCode = "codestream:interaction:code-highlighted",
	didScroll = "codestream:interaction:scrolled",
	didSignOut = "codestream:interaction:signed-out",
	onActiveThreadChanged = "codestream:interaction:thread-selected",
	onActiveThreadClosed = "codestream:interaction:thread-closed",
	onActiveStreamChanged = "codestream:interaction:changed-active-stream",
	onFileChangedSubscribe = "codestream:subscription:file-changed",
	onFileChangedUnsubscribe = "codestream:unsubscribe:file-changed",
	onRequest = "codestream:request",
	onServiceRequest = "codestream:interaction:svc-request",
	onReloadRequest = "codestream:interaction:clicked-reload-webview",
	onViewReady = "codestream:view-ready",
	response = "codestream:response",
	onActivePanelChanged = "codestream:interaction:active-panel-changed"
}

export function toLoggableIpcMessage(msg: WebviewIpcMessage) {
	switch (msg.type) {
		case WebviewIpcMessageType.response:
			return `${msg.type}(${msg.body.id || ""})`;

		case WebviewIpcMessageType.onRequest:
			return `${msg.type}(${msg.body.id || ""}):${msg.body.action || ""}`;

		case WebviewIpcMessageType.response:
			return `${msg.type}(${msg.body.id || ""})`;

		case WebviewIpcMessageType.didChangeData:
			return `${msg.type}(${msg.body.type || ""})`;

		default:
			return msg.type;
	}
}

// TODO: Clean this up to be consistent with the structure
export interface WebviewIpcMessage {
	type: WebviewIpcMessageType;
	body: any;
}

export interface WebviewIpcMessageResponseBody {
	id: string;
	payload?: any;
	error?: string;
}

export interface DidChangeActiveEditorNotification {
	type: WebviewIpcMessageType.didChangeActiveEditor;
	body: {
		editor:
			| {
					uri: string;
					fileName: string;
					languageId: string;
					fileStreamId?: string;
			  }
			| undefined;
	};
}

export interface DidSelectCodeNotification {
	type: WebviewIpcMessageType.didSelectCode;
	body: {
		code: string;
		file: string | undefined;
		fileUri: string;
		location: [number, number, number, number];
		source:
			| {
					file: string;
					repoPath: string;
					revision: string;
					authors: {
						id: string;
						username: string;
					}[];
					remotes: {
						name: string;
						url: string;
					}[];
			  }
			| undefined;
		gitError: string | undefined;
		isHighlight?: boolean;
	};
}

export interface DidScrollNotification {
	type: WebviewIpcMessageType.didScroll;
	body: {
		uri: Uri;
		firstLine: number;
		lastLine: number;
	};
}

export interface VslsInviteServiceRequestAction {
	type: "invite";
	userId: string;
	createNewStream?: Boolean;
}

export interface VslsJoinServiceRequestAction {
	type: "join";
	url: string;
}

export interface VslsStartServiceRequestAction {
	type: "start";
	streamId: string;
	threadId?: string;
	createNewStream?: Boolean;
}

export type VslsServiceRequestAction =
	| VslsInviteServiceRequestAction
	| VslsJoinServiceRequestAction
	| VslsStartServiceRequestAction;

export interface VslsServiceRequest {
	service: "vsls";
	action: VslsServiceRequestAction;
}

export type ServiceRequest = VslsServiceRequest;

export class WebviewIpc {
	static readonly QueueThreshold = 100;

	private _panel: WebviewPanel | undefined;
	private readonly _queue: WebviewIpcMessage[] = [];

	constructor(private readonly _webview: CodeStreamWebviewPanel) {}

	private _paused: boolean = false;
	get paused() {
		return this._paused;
	}

	connect(panel: WebviewPanel) {
		this._panel = panel;
		// Don't start the ipc right away, we need to wait until the webview is ready to receive
		this._paused = true;
		this._queue.length = 0;
	}

	clear() {
		this._queue.length = 0;
	}

	async resume() {
		if (!this.paused && this._queue.length === 0) return;

		this._paused = false;
		if (this._queue.length > WebviewIpc.QueueThreshold) {
			Logger.log("WebviewPanel: Too out of date; reloading...");

			this._queue.length = 0;
			await this._webview.reload();

			return false;
		}

		Logger.log("WebviewPanel: Resuming communication...");

		return this.flushQueue();
	}

	sendDidBlur() {
		return this.postMessage({
			type: WebviewIpcMessageType.didBlur,
			body: {}
		});
	}

	sendDidConnect() {
		return this.postMessage({
			type: WebviewIpcMessageType.didConnect,
			body: {}
		});
	}

	sendDidDisconnect() {
		return this.postMessage({
			type: WebviewIpcMessageType.didDisconnect,
			body: {}
		});
	}

	sendDidFocus() {
		return this.postMessage({
			type: WebviewIpcMessageType.didFocus,
			body: {}
		});
	}

	async sendDidChangeActiveEditor(editor: TextEditor | undefined) {
		const message: DidChangeActiveEditorNotification = {
			type: WebviewIpcMessageType.didChangeActiveEditor,
			body: {
				editor: undefined
			}
		};

		if (editor != null) {
			const uri = editor.document.uri;
			if (uri.scheme === "file") {
				const { stream } = await Container.agent.streams.getFileStream(uri.toString());
				const folder = workspace.getWorkspaceFolder(uri);
				const fileName =
					folder !== undefined
						? path.relative(folder.uri.fsPath, uri.fsPath)
						: editor.document.fileName;

				message.body.editor = {
					fileStreamId: stream && stream.id,
					uri: uri.toString(),
					fileName: fileName,
					languageId: editor.document.languageId
				};
			}
		}

		return this.postMessage(message);
	}

	sendDidChangeStreamThread(streamThread: StreamThread) {
		return this.postMessage({
			type: WebviewIpcMessageType.didChangeStreamThread,
			body: {
				streamId: streamThread.stream.id,
				threadId: streamThread.id
			}
		});
	}

	onServiceRequest(msg: ServiceRequest) {
		switch (msg.service) {
			case "vsls":
				Container.vsls.processRequest(msg.action);
		}
	}

	/*private*/ async postMessage(msg: WebviewIpcMessage) {
		if (this._panel === undefined) {
			Logger.log(
				`WebviewPanel: FAILED posting ${toLoggableIpcMessage(
					msg
				)} to the webview; Webview has not been created yet`
			);

			throw new Error("Webview has not been created yet");
		}

		if (this._paused) {
			// HACK: If this is a response to a request try to service it
			if (msg.type === WebviewIpcMessageType.response) {
				const success = await this.postMessageCore(msg);
				if (success) return true;
			}

			this.enqueue(msg);

			Logger.log(
				`WebviewPanel: FAILED posting ${toLoggableIpcMessage(
					msg
				)} to the webview; Webview is invisible and can't receive messages`
			);

			return false;
		}

		// If there is a pending flush operation, wait until it completes
		if (this._flushingPromise !== undefined) {
			if (!(await this._flushingPromise)) {
				Logger.log(`WebviewPanel: FAILED posting ${toLoggableIpcMessage(msg)} to the webview`);

				return false;
			}
		}

		const success = await this.postMessageCore(msg);
		if (!success) {
			this.enqueue(msg);
		}
		return success;
	}

	private async postMessageCore(msg: WebviewIpcMessage) {
		let success;
		try {
			success = await this._panel!.webview.postMessage(msg);
		} catch (ex) {
			Logger.error(ex);
			success = false;
		}

		if (!success) {
			this._paused = true;
		}

		Logger.log(
			`WebviewPanel: ${success ? "Completed" : "FAILED"} posting ${toLoggableIpcMessage(
				msg
			)} to the webview`
		);

		return success;
	}

	private enqueue(msg: WebviewIpcMessage) {
		// Don't add any more messages if we are over the threshold
		if (this._queue.length > WebviewIpc.QueueThreshold) return;

		this._queue.push(msg);
	}

	private _flushingPromise: Promise<boolean> | undefined;
	private async flushQueue() {
		try {
			if (this._flushingPromise === undefined) {
				this._flushingPromise = this.flushQueueCore();
			}
			return await this._flushingPromise;
		} finally {
			this._flushingPromise = undefined;
		}
	}

	private async flushQueueCore() {
		Logger.log("WebviewPanel: Flushing pending queue");

		while (this._queue.length !== 0) {
			const msg = this._queue.shift();
			if (msg === undefined) continue;

			if (!(await this.postMessageCore(msg))) {
				this._queue.unshift(msg);

				Logger.log("WebviewPanel: FAILED flushing pending queue");
				return false;
			}
		}

		Logger.log("WebviewPanel: Completed flushing pending queue");
		return true;
	}
}
