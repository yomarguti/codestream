'use strict';
import { commands, Disposable, Event, EventEmitter, Range, ViewColumn, Webview, WebviewPanel, WebviewPanelOnDidChangeViewStateEvent, window } from 'vscode';
import { CSPost, CSRepository, CSStream, CSTeam, CSUser } from '../api/api';
import { CodeStreamSession, Post, PostsReceivedEvent, Stream } from '../api/session';
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

// TODO: Clean this up to be consistent with the structure
interface CSWebviewRequest {
    type: string;
    body: {
        action?: string;
        name?: string;
        params?: any;
        payload?: any;
        type?: string;
    };
}

class MessageRelay extends Disposable {
    private readonly _disposable: Disposable;

    constructor(
        public readonly session: CodeStreamSession,
        private readonly _webview: Webview,
        private _stream: Stream
    ) {
        super(() => this.dispose());

        this._disposable = Disposable.from(
            _webview.onDidReceiveMessage(this.onWebViewMessageReceived, this)
        );
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    private async onWebViewMessageReceived(e: CSWebviewRequest) {
        const { type, body } = e;

        const createRange = (array: number[][]) => new Range(array[0][0], array[0][1], array[1][0], array[1][1]);

        switch (type) {
            case 'action-request':
                switch (body.action) {
                    case 'post':
                        const { text, codeBlocks, commitHashWhenPosted } = body.params;

                        let post;
                        if (codeBlocks) {
                            post = await this._stream.postCode(text, codeBlocks[0].code, createRange(codeBlocks[0].location), commitHashWhenPosted, codeBlocks[0].streamId);
                            if (post === undefined) return;
                        } else {
                            post = await this._stream.post(text);
                            if (post === undefined) return;
                        }

                        this.postMessage({
                            type: 'action-response',
                            body: {
                                action: body.action,
                                payload: post.entity
                            }
                        });
                }
                break;

            case 'event': {
                switch (body.name) {
                    case 'post-clicked':
                        if (body.payload.codeBlocks === undefined) return;

                        commands.executeCommand('codestream.openPostWorkingFile', new Post(this.session, body.payload, this._stream));
                        return;
                }
                break;
            }
        }
    }

    postMessage(request: CSWebviewRequest) {
        return this._webview.postMessage(request);
    }

    setStream(stream: Stream) {
        this._stream = stream;
    }
}

export class StreamWebviewPanel extends Disposable {

    private _onDidClose = new EventEmitter<void>();
    get onDidClose(): Event<void> {
        return this._onDidClose.event;
    }

    private readonly _disposable: Disposable;
    private readonly _panel: WebviewPanel;
    private _relay: MessageRelay | undefined;
    private _stream: Stream | undefined;

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
            session.onDidReceivePosts(this.onPostsReceived, this),
            this._panel.onDidChangeViewState(this.onPanelViewStateChanged, this),
            this._panel.onDidDispose(this.onPanelDisposed, this)
        );
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    private onPostsReceived(e: PostsReceivedEvent) {
        if (this._relay === undefined) return;

        this._relay.postMessage({
            type: 'push-data',
            body: {
                type: 'posts',
                payload: e.getPosts().map(post => ({ ...post.entity }))
            }
        });
    }

    is(stream: Stream) {
        if (this._stream === undefined) return false;
        return this._stream.id === stream.id;
    }

    postCode(repoId: string, relativePath: string, code: string, range: Range, commitHash: string, mentions: string = '') {
        if (this._relay === undefined) throw new Error('No Webview relay');

        const normalize = (r: Range) => [[r.start.line, r.start.character], [r.end.line, r.end.character]];

        this._relay.postMessage({
            type: 'ui-data',
            body: {
                type: 'SELECTED_CODE',
                payload: {
                    file: relativePath,
                    repoId: repoId,
                    content: code,
                    range: normalize(range),
                    commitHash: commitHash,
                    mentions: mentions
                }
            }
        });
    }

    show() {
        return this._panel.reveal(ViewColumn.Three);
    }

    private onPanelViewStateChanged(e: WebviewPanelOnDidChangeViewStateEvent) {
        Logger.log('WebView.ViewStateChanged', e);
    }

    private onPanelDisposed() {
        this._onDidClose.fire();
    }

    async setStream(stream: Stream) {
        if (this._stream && this._stream.id === stream.id) return this.show();

        this._panel.title = `CodeStream \u2022 ${stream.name}`;
        this._stream = stream;

        if (this._relay === undefined) {
            this._relay = new MessageRelay(this.session, this._panel.webview, stream);
        }
        else {
            this._relay.setStream(stream);
        }

        const state: ViewData = Object.create(null);
        state.currentTeamId = stream.teamId;
        state.currentUserId = this.session.userId;
        state.currentStreamId = stream.id;
        state.streams = [stream.entity];

        [state.posts, state.repos, state.teams, state.users] = await Promise.all([
            stream.posts.entities(),
            this.session.repos.entities(),
            this.session.teams.entities(),
            this.session.users.entities()
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

        return this.show();
    }
}
