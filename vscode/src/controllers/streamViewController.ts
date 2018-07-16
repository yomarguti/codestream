"use strict";
import { Disposable, Range } from "vscode";
import {
	CodeStreamSession,
	Repository,
	SessionStatus,
	SessionStatusChangedEvent,
	StreamThread
} from "../api/session";
import { Container } from "../container";
import { StreamWebviewPanel } from "../webviews/streamWebviewPanel";

export class StreamViewController implements Disposable {
	private _disposable: Disposable | undefined;
	private _disposablePanel: Disposable | undefined;
	private _panel: StreamWebviewPanel | undefined;
	private _lastStreamThread: StreamThread | undefined;

	constructor(public readonly session: CodeStreamSession) {
		this._disposable = Disposable.from(
			Container.session.onDidChangeStatus(this.onSessionStatusChanged, this)
		);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
		this.closePanel();
	}

	private onPanelClosed() {
		this.closePanel();
	}

	private onSessionStatusChanged(e: SessionStatusChangedEvent) {
		if (e.getStatus() === SessionStatus.SignedOut) {
			this.closePanel();
		}
	}

	get activeStreamThread() {
		if (this._panel === undefined) return undefined;

		return this._panel.streamThread;
	}

	get visible() {
		return this._panel === undefined ? false : this._panel.visible;
	}

	hide() {
		if (this._panel === undefined) return;

		this._panel.hide();
	}

	async post(streamThread: StreamThread, text: string) {
		await this.show(streamThread);
		return this._panel!.post(text);
	}

	async postCode(
		streamThread: StreamThread,
		repo: Repository,
		relativePath: string,
		code: string,
		range: Range,
		commitHash: string,
		text?: string,
		mentions: string = ""
	) {
		await this.show(streamThread);
		return this._panel!.postCode(repo.id, relativePath, code, range, commitHash, text, mentions);
	}

	async show(streamThread?: StreamThread) {
		// HACK: 💩
		Container.notifications.clearUnreadCount();

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
				this._panel,
				this._panel.onDidClose(this.onPanelClosed, this)
			);
		}

		return this._panel.show(streamThread);
	}

	toggle() {
		return this.visible ? this.hide() : this.show();
	}

	private closePanel() {
		this._lastStreamThread = this.activeStreamThread;

		this._disposablePanel && this._disposablePanel.dispose();
		this._disposablePanel = undefined;
		this._panel = undefined;
	}
}
