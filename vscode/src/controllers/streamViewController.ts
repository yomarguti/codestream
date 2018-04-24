'use strict';
import { Disposable, Range } from 'vscode';
import { CodeStreamSession, Repository, Stream } from '../api/session';
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

    async openStream(stream: Stream) {
        if (this._panel === undefined) {
            this._panel = new StreamWebviewPanel(this.session);

            this._disposable = Disposable.from(
                this._panel,
                this._panel.onDidClose(this.onPanelClosed, this)
            );
        }

        return this._panel.setStream(stream);
    }

    async postCode(stream: Stream, repo: Repository, relativePath: string, code: string, range: Range, commitHash: string, mentions: string = '') {
        await this.openStream(stream);

        this._panel!.postCode(repo.id, relativePath, code, range, commitHash, mentions);
    }
}
