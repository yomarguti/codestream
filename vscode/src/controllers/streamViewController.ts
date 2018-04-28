'use strict';
import { Disposable, Range } from 'vscode';
import { CodeStreamSession, Repository, Stream } from '../api/session';
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

    get activeStream() {
        if (this._panel === undefined) return;
        return this._panel.stream;
    }

    async openStream(stream: Stream): Promise<Stream> {
        if (this._panel === undefined) {
            this._panel = new StreamWebviewPanel(this.session);

            this._disposable = Disposable.from(
                this._panel,
                this._panel.onDidClose(this.onPanelClosed, this)
            );
        }

        // TODO: Switch to codestream view?
        Container.explorer.show();
        return this._panel.setStream(stream);
    }

    async post(stream: Stream, text: string) {
        await this.openStream(stream);
        return this._panel!.post(text);
    }

    async postCode(stream: Stream, repo: Repository, relativePath: string, code: string, range: Range, commitHash: string, text?: string, mentions: string = '') {
        await this.openStream(stream);
        return this._panel!.postCode(repo.id, relativePath, code, range, commitHash, text, mentions);
    }
}
