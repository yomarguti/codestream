"use strict";
import * as path from "path";
import { TextEditor, WebviewPanel, workspace } from "vscode";
import { StreamThread } from "../api/session";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	DidBlurNotification,
	DidChangeActiveEditorNotification,
	DidChangeActiveEditorNotificationType,
	DidEstablishConnectivityNotificationType,
	DidFocusNotification,
	DidLoseConnectivityNotificationType,
	DidSelectStreamThreadNotification,
	DidSelectStreamThreadNotificationType,
	WebviewIpcMessage
} from "../shared/webview.protocol";
import { CodeStreamWebviewPanel } from "./webviewPanel";

export function toLoggableIpcMessage(msg: WebviewIpcMessage) {
	if (msg.id) {
		return `${msg.method || "response"}(${msg.id})`;
	}
	return `${msg.method}`;
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
		return this.postMessage(DidBlurNotification);
	}

	sendDidConnect() {
		return this.postMessage(DidEstablishConnectivityNotificationType);
	}

	sendDidDisconnect() {
		return this.postMessage(DidLoseConnectivityNotificationType);
	}

	sendDidFocus() {
		return this.postMessage(DidFocusNotification);
	}

	sendResponse(response: { id: string; params: any } | { id: string; error: any }) {
		return this.postMessage({
			...response
		} as WebviewIpcMessage);
	}

	async sendDidChangeActiveEditor(editor: TextEditor | undefined) {
		const message = {
			method: DidChangeActiveEditorNotificationType.method,
			params: {
				editor: undefined
			} as DidChangeActiveEditorNotification
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

				message.params.editor = {
					fileStreamId: stream && stream.id,
					// uri: uri.toString(),
					fileName: fileName
					// languageId: editor.document.languageId
				};
			}
		}

		return this.postMessage(message);
	}

	sendDidChangeStreamThread(streamThread: StreamThread) {
		return this.postMessage({
			method: DidSelectStreamThreadNotificationType.method,
			params: {
				streamId: streamThread.stream.id,
				threadId: streamThread.id
			} as DidSelectStreamThreadNotification
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
			if (msg.id && !msg.method) {
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
