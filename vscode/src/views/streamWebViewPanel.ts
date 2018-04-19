import { Disposable, Event, EventEmitter, ViewColumn, Webview, WebviewPanel, WebviewPanelOnDidChangeViewStateEvent, window } from 'vscode';
import { CSPost, CSRepository, CSStream, CSTeam, CSUser } from '../api/api';
import { CodeStreamSession, Stream } from '../api/session';
import { Container } from '../container';
import * as fs from 'fs';
import { Logger } from '../logger';

interface ViewData {
    currentTeamId: string;
    // currentRepoId: string;
    currentUserId: string;
    currentStreamId: string;
    // currentFileId?: string;
    // currentCommit?: string;
    posts: CSPost[];
    streams: CSStream[];
    teams: CSTeam[];
    users: CSUser[];
    repos: CSRepository[];
}

interface CSWebviewRequest {
    type: string;
    body: {
        action: string;
        params: any;
    };
}

class MessageRelay {
    constructor(
        public readonly session: CodeStreamSession,
        private readonly view: Webview,
        private readonly stream: Stream
    ) {
        session.onDidReceivePosts(event => {
            view.postMessage({
                type: 'push-data',
                body: {
                    type: 'posts',
                    payload: event.getPosts().map(post => ({ ...post.entity }))
                }
            });
        });

        view.onDidReceiveMessage(async (event: CSWebviewRequest) => {
            const { type, body } = event;
            if (type === 'action-request') {
                if (body.action === 'post') {
                    const post = await this.stream.post(body.params.text);
                    post &&
                        this.view.postMessage({
                            type: 'action-response',
                            body: {
                                action: body.action,
                                payload: post.entity
                            }
                        });
                }
            }
        }, null);
    }
}

export class StreamWebViewController extends Disposable {

    private _disposable: Disposable | undefined;
    private _panel: StreamWebViewPanel | undefined;

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
            this._panel = new StreamWebViewPanel(this.session);

            this._disposable = Disposable.from(
                this._panel,
                this._panel.onDidClose(this.onPanelClosed, this)
            );
        }

        this._panel.setStream(stream);
    }
}

export class StreamWebViewPanel extends Disposable {

    private _onDidClose = new EventEmitter<void>();
    get onDidClose(): Event<void> {
        return this._onDidClose.event;
    }

    private readonly _disposable: Disposable;
    private readonly _panel: WebviewPanel;

    constructor(private readonly session: CodeStreamSession) {
        super(() => this.dispose());

        this._panel = window.createWebviewPanel(
            'CodeStream.stream',
            'CodeStream',
            ViewColumn.Three,
            {
                retainContextWhenHidden: true,
                enableFindWidget: true,
                enableCommandUris: true,
                enableScripts: true
            }
        );

        this._disposable = Disposable.from(
            this._panel.onDidChangeViewState(this.onPanelViewStateChanged, this),
            this._panel.onDidDispose(this.onPanelDisposed, this)
        );
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    is(stream: Stream) {
        if (this._stream === undefined) return false;
        return this._stream.id === stream.id;
    }

    show() {
        this._panel.reveal(ViewColumn.Three);
    }

    private onPanelViewStateChanged(e: WebviewPanelOnDidChangeViewStateEvent) {
        Logger.log('WebView.ViewStateChanged', e);
    }

    private onPanelDisposed() {
        this._onDidClose.fire();
    }

    private _stream: Stream | undefined;
    private _relay: MessageRelay | undefined;

    async setStream(stream: Stream) {
        if (this._stream && this._stream.id === stream.id) {
            this.show();

            return;
        }

        this._stream = stream;
        this._relay = new MessageRelay(this.session, this._panel.webview, stream);

        const state: ViewData = Object.create(null);
        state.currentTeamId = stream.teamId;
        state.currentUserId = this.session.userId;
        state.currentStreamId = stream.id;
        state.streams = [stream.entity];

        [state.posts, state.repos, state.teams, state.users] = await Promise.all([
            stream.posts.entities,
            this.session.repos.entities,
            this.session.teams.entities,
            this.session.users.entities
        ]);

        const htmlPath = Container.context.asAbsolutePath('/assets/index.html');
        const scriptPath = Container.context.asAbsolutePath('/assets/app.js');
        const stylesPath = Container.context.asAbsolutePath('/assets/styles/stream.css');

        const html = fs
            .readFileSync(htmlPath, {
                encoding: 'utf-8'
            })
            .replace('{% bootstrap-data %}', JSON.stringify(state))
            .replace('{% script-path %}', scriptPath)
            .replace('{% styles-path %}', stylesPath);
        this._panel.webview.html = html;

        this.show();
    }
}
