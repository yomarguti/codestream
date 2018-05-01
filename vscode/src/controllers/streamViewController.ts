'use strict';
import { Disposable, Range } from 'vscode';
import { CodeStreamSession, Repository, StreamThread } from '../api/session';
import { StreamWebviewPanel } from '../views/streamWebviewPanel';
import { Container } from '../container';

export class StreamViewController extends Disposable {

    private _disposable: Disposable | undefined;
    private _panel: StreamWebviewPanel | undefined;
    private _lastStreamThread: StreamThread | undefined;

    constructor(public readonly session: CodeStreamSession) {
        super(() => this.dispose());
    }

    dispose() {
        this._disposable && this._disposable.dispose();
        this._disposable = undefined;
        this._panel = undefined;
     }

    private onPanelClosed() {
        this._lastStreamThread = this.activeStreamThread;
        this.dispose();
    }

    get activeStreamThread() {
        if (this._panel === undefined) return undefined;

        return this._panel.streamThread;
    }

    get visible() {
        return this._panel === undefined ? false : this._panel.visible;
    }

    async openStreamThread(streamThread: StreamThread): Promise<StreamThread> {
        if (this._panel === undefined) {
            this._panel = new StreamWebviewPanel(this.session);

            this._disposable = Disposable.from(
                this._panel,
                this._panel.onDidClose(this.onPanelClosed, this)
            );
        }

        return this._panel.setStream(streamThread);
    }

    async post(streamThread: StreamThread, text: string) {
        await this.openStreamThread(streamThread);
        return this._panel!.post(text);
    }

    async postCode(streamThread: StreamThread, repo: Repository, relativePath: string, code: string, range: Range, commitHash: string, text?: string, mentions: string = '') {
        await this.openStreamThread(streamThread);
        return this._panel!.postCode(repo.id, relativePath, code, range, commitHash, text, mentions);
    }

    async show() {
        // HACK: 💩
        Container.notifications.clearUnreadCount();

        if (this._panel !== undefined) return this._panel.show();

        let streamThread = this._lastStreamThread;
        if (streamThread === undefined) {
            streamThread = { id: undefined, stream: await this.session.getDefaultTeamChannel() };
        }

        return this.openStreamThread(streamThread);
    }
}
