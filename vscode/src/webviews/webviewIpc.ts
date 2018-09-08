"use strict";
import { WebviewPanel } from "vscode";
import { StreamThread } from "../api/session";
import { Container } from "../container";
import { Logger } from "../logger";
import { StreamWebviewPanel } from "./streamWebviewPanel";

export enum WebviewIpcMessageType {
	didBlur = "codestream:interaction:blur",
	didChangeConfiguration = "codestream:configs",
	didChangeData = "codestream:data",
	didChangeStreamThread = "codestream:interaction:stream-thread-selected",
	didChangeUnreads = "codestream:data:unreads",
	didFileChange = "codestream:publish:file-changed",
	didFocus = "codestream:interaction:focus",
	didPostCode = "codestream:interaction:code-highlighted",
	didSignOut = "codestream:interaction:signed-out",
	onActiveThreadChanged = "codestream:interaction:thread-selected",
	onActiveThreadClosed = "codestream:interaction:thread-closed",
	onActiveStreamChanged = "codestream:interaction:changed-active-stream",
	onFileChangedSubscribe = "codestream:subscription:file-changed",
	onFileChangedUnsubscribe = "codestream:unsubscribe:file-changed",
	onRequest = "codestream:request",
	onServiceRequest = "codestream:interaction:svc-request",
	onViewReady = "codestream:view-ready",
	response = "codestream:response",
	didDisconnect = "codestream:connectivity:offline",
	didConnect = "codestream:connectivity:online"
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

export interface VslsInviteServiceRequestAction {
	type: "invite";
	userId: string;
}

export interface VslsJoinServiceRequestAction {
	type: "join";
	url: string;
}

export interface VslsStartServiceRequestAction {
	type: "start";
	streamId: string;
	threadId?: string;
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

	constructor(private readonly _webview: StreamWebviewPanel) {}

	private _paused: boolean = false;
	get paused() {
		return this._paused;
	}

	connect(panel: WebviewPanel) {
		this._panel = panel;
		this._paused = false;
		this._queue.length = 0;
	}

	async resume() {
		if (!this.paused && this._queue.length === 0) return;

		this._paused = false;
		if (this._queue.length > WebviewIpc.QueueThreshold) {
			Logger.log("WebviewPanel: Too out of date; reloading...");

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

	sendDidFocus() {
		return this.postMessage({
			type: WebviewIpcMessageType.didFocus,
			body: {}
		});
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

		const success = this.postMessageCore(msg);
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
