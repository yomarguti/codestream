'use strict';
import { Disposable, Range } from 'vscode';
import { CodeStreamSession, Repository, StreamThread } from '../api/session';
import { Container } from '../container';
import { StreamWebviewPanel } from '../views/streamWebviewPanel';

export class StreamViewController extends Disposable {

    private _disposable: Disposable | undefined;
    private _panel: StreamWebviewPanel | undefined;

    constructor(public readonly session: CodeStreamSession) {
        super(() => this.dispose());
    }

    dispose() {
        this._disposable && this._disposable.dispose();
        this._disposable = undefined;
        this._panel = undefined;
     }

    private onPanelClosed() {
        this.dispose();
    }

    get activeStreamThread() {
        if (this._panel === undefined) return undefined;

        return this._panel.streamThread;
    }

    async openStreamThread(streamThread: StreamThread): Promise<StreamThread> {
        if (this._panel === undefined) {
            this._panel = new StreamWebviewPanel(this.session);

            this._disposable = Disposable.from(
                this._panel,
                this._panel.onDidClose(this.onPanelClosed, this)
            );
        }

        // TODO: Switch to codestream view?
        Container.commands.show();
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
}
