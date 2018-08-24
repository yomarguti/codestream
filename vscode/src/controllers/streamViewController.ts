"use strict";
import { Disposable, Range, Uri, ViewColumn } from "vscode";
import {
	CodeStreamSession,
	SessionStatus,
	SessionStatusChangedEvent,
	SessionStatusSignedOutReason,
	StreamThread
} from "../api/session";
import { WorkspaceState } from "../common";
import { Container } from "../container";
import { StreamWebviewPanel } from "../webviews/streamWebviewPanel";

export interface StreamThreadId {
	id: string | undefined;
	streamId: string;
}

export interface WebviewState {
	hidden: boolean;
	streamThread?: StreamThreadId;
}

export class StreamViewController implements Disposable {
	private _disposable: Disposable | undefined;
	private _disposablePanel: Disposable | undefined;
	private _panel: StreamWebviewPanel | undefined;
	private _lastStreamThread: StreamThread | undefined;

	constructor(public readonly session: CodeStreamSession) {
		this._disposable = Disposable.from(
			Container.session.onDidChangeSessionStatus(this.onSessionStatusChanged, this)
		);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
		this.closePanel();
	}

	private onPanelStreamChanged(streamThread: StreamThread) {
		this.updateState(streamThread);
	}

	private onPanelClosed() {
		this.closePanel("user");
	}

	private async onSessionStatusChanged(e: SessionStatusChangedEvent) {
		const status = e.getStatus();
		switch (status) {
			case SessionStatus.SignedOut:
				if (e.reason === SessionStatusSignedOutReason.SignInFailure) {
					if (!this.visible) {
						this.show();
					}
					break;
				}

				if (this.visible) {
					this._panel!.signedOut();
				} else {
					this.closePanel();
				}
				break;

			case SessionStatus.SignedIn:
				const state = {
					hidden: false,
					...(Container.context.workspaceState.get<WebviewState>(WorkspaceState.webviewState) || {})
				} as WebviewState;

				if (state.streamThread !== undefined) {
					const stream = await this.session.getStream(state.streamThread.streamId);
					this._lastStreamThread =
						stream !== undefined ? { id: state.streamThread.id, stream: stream } : undefined;
				}

				if (!state.hidden) {
					this.show(this._lastStreamThread);
				}
				break;
		}
	}

	get activeStreamThread() {
		if (this._panel === undefined) return undefined;

		return this._panel.streamThread;
	}

	get viewColumn(): ViewColumn | undefined {
		return this._panel === undefined ? undefined : this._panel.viewColumn;
	}

	get visible() {
		return this._panel === undefined ? false : this._panel.visible;
	}

	hide() {
		if (this._panel === undefined) return;

		this._panel.hide();
	}

	async postCode(
		code: string,
		uri: Uri,
		range: Range,
		source?: {
			file: string;
			repoPath: string;
			revision: string;
			authors: { id: string; username: string }[];
			remotes: { name: string; url: string }[];
		},
		gitError?: string
	) {
		await this.show();
		return this._panel!.postCode(code, uri, range, source, gitError);
	}

	async show(streamThread?: StreamThread) {
		if (this._panel === undefined) {
			if (streamThread === undefined) {
				streamThread = this._lastStreamThread;
				// streamThread = this._lastStreamThread || {
				// 	id: undefined,
				// 	stream: await this.session.getDefaultTeamChannel()
				// };
			}

			this._panel = new StreamWebviewPanel(this.session);

			this._disposablePanel = Disposable.from(
				this._panel.onDidChangeStream(this.onPanelStreamChanged, this),
				this._panel.onDidClose(this.onPanelClosed, this),
				// Keep this at the end otherwise the above subscriptions can fire while disposing
				this._panel
			);
		}

		return this._panel.show(streamThread);
	}

	toggle() {
		return this.visible ? this.hide() : this.show();
	}

	private closePanel(reason?: "user") {
		this.updateState(this.activeStreamThread, reason === "user");

		this._disposablePanel && this._disposablePanel.dispose();
		this._disposablePanel = undefined;
		this._panel = undefined;
	}

	private updateState(streamThread: StreamThread | undefined, hidden: boolean = false) {
		this._lastStreamThread = streamThread;

		let streamThreadId: StreamThreadId | undefined;
		if (streamThread !== undefined) {
			streamThreadId = { id: streamThread.id, streamId: streamThread.stream.id };
		}
		Container.context.workspaceState.update(WorkspaceState.webviewState, {
			hidden: hidden,
			streamThread: streamThreadId
		} as WebviewState);
	}
}
