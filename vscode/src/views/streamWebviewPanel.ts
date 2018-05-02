'use strict';
import { Disposable, Event, EventEmitter, Range, ViewColumn, WebviewPanel, WebviewPanelOnDidChangeViewStateEvent, window } from 'vscode';
import { CSPost, CSRepository, CSStream, CSTeam, CSUser } from '../api/api';
import { CodeStreamSession, Post, PostsReceivedEvent, SessionChangedEvent, SessionChangedType, StreamThread } from '../api/session';
import { Container } from '../container';
import { Logger } from '../logger';
import * as fs from 'fs';

interface BootstrapState {
    currentTeamId: string;
    // currentRepoId: string;
    currentUserId: string;
    currentStreamId: string;
    // currentFileId?: string;
    // currentCommit?: string;
    selectedPostId?: string;
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

export class StreamWebviewPanel extends Disposable {

    private _onDidClose = new EventEmitter<void>();
    get onDidClose(): Event<void> {
        return this._onDidClose.event;
    }

    private readonly _disposable: Disposable;
    private readonly _panel: WebviewPanel;
    private _streamThread: StreamThread | undefined;

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
            session.onDidChange(this.onSessionChanged, this),
            this._panel,
            this._panel.onDidDispose(this.onPanelDisposed, this),
            this._panel.onDidChangeViewState(this.onPanelViewStateChanged, this),
            this._panel.webview.onDidReceiveMessage(this.onPanelWebViewMessageReceived, this)
        );
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    private onPanelDisposed() {
        this._onDidClose.fire();
    }

    private _invalidateOnVisible: boolean = false;
    private onPanelViewStateChanged(e: WebviewPanelOnDidChangeViewStateEvent) {
        Logger.log('WebView.ViewStateChanged', e.webviewPanel.visible);
        // HACK: Because messages aren't sent to the webview when hidden, we need to reset the whole view if we are invalid
        if (this._invalidateOnVisible && this.streamThread !== undefined && e.webviewPanel.visible) {
            this._invalidateOnVisible = false;
            this.setStream(this.streamThread);
        }
    }

    private async onPanelWebViewMessageReceived(e: CSWebviewRequest) {
        if (this._streamThread === undefined) return;

        const { type, body } = e;

        const createRange = (array: number[][]) => new Range(array[0][0], array[0][1], array[1][0], array[1][1]);

        switch (type) {
            case 'action-request':
                switch (body.action) {
                    case 'post':
                        const { text, codeBlocks, commitHashWhenPosted, parentPostId } = body.params;

                        let post;
                        if (codeBlocks === undefined || codeBlocks.length === 0) {
                            post = await this._streamThread.stream.post(text, parentPostId);
                        }
                        else {
                            const block = codeBlocks[0];
                            let markerStream;
                            if (block.streamId === undefined) {
                                markerStream = {
                                    file: block.file!,
                                    repoId: block.repoId!
                                };
                            }
                            else {
                                markerStream = block.streamId;
                            }

                            post = await this._streamThread.stream.postCode(text, block.code, createRange(block.location), commitHashWhenPosted, markerStream, parentPostId);
                        }

                        if (post === undefined) return;

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

                        await Container.commands.openPostWorkingFile(new Post(this.session, body.payload, this._streamThread.stream));
                        break;

                    case 'post-diff-clicked':
                        if (body.payload === undefined) return;

                        await Container.commands.comparePostFileRevisionWithWorking(new Post(this.session, body.payload, this._streamThread.stream));
                        break;

                    case 'post-deleted':
                        if (body.payload === undefined) return;

                        await Container.session.api.deletePost(body.payload.id);
                        break;

                    case 'thread-selected':
                        const { threadId, streamId } = body.payload;
                        if (this._streamThread !== undefined && this._streamThread.stream.id === streamId) {
                            this._streamThread.id = threadId;
                        }
                        break;
                }
                break;
            }
        }
    }

    private onPostsReceived(e: PostsReceivedEvent) {
        if (this._streamThread === undefined) return;

        this.postMessage({
            type: 'push-data',
            body: {
                type: 'posts',
                payload: e.entities()
            }
        });
    }

    private onSessionChanged(e: SessionChangedEvent) {
        if (this._streamThread === undefined) return;

        switch (e.type) {
            case SessionChangedType.Streams:
            case SessionChangedType.Repositories:
                this.postMessage({
                    type: 'push-data',
                    body: {
                        type: e.type,
                        payload: e.entities()
                    }
                });
                break;
        }
    }

    get streamThread() {
        return this._streamThread;
    }

    get visible() {
        return this._panel === undefined ? false : this._panel.visible;
    }

    hide() {
        if (this._panel === undefined) return;

        this._panel.dispose();
    }

    post(text: string) {
        return this.postMessage({
            type: 'interaction',
            body: {
                type: 'SELECTED_CODE',
                payload: {
                    text: text
                }
            }
        });
    }

    postCode(repoId: string, relativePath: string, code: string, range: Range, commitHash: string, text?: string, mentions: string = '') {
        const normalize = (r: Range) => [[r.start.line, r.start.character], [r.end.line, r.end.character]];

        return this.postMessage({
            type: 'interaction',
            body: {
                type: 'SELECTED_CODE',
                payload: {
                    file: relativePath,
                    repoId: repoId,
                    content: code,
                    range: normalize(range),
                    commitHash: commitHash,
                    text: text,
                    mentions: mentions
                }
            }
        });
    }

    show(streamThread?: StreamThread) {
        if (streamThread === undefined ||
            (this._streamThread && this._streamThread.id === streamThread.id &&
            this._streamThread.stream.id === streamThread.stream.id)) {
            this._panel.reveal(undefined, false);

            return this._streamThread;
        }

        return this.setStream(streamThread);
    }

    private async postMessage(request: CSWebviewRequest) {
        const success = await this._panel.webview.postMessage(request);
        if (!success) {
            this._invalidateOnVisible = true;
        }
    }

    private async setStream(streamThread: StreamThread): Promise<StreamThread> {
        const label = await streamThread.stream.label();
        this._panel.title = `${label} \u00a0\u2022\u00a0 CodeStream`;
        this._streamThread = streamThread;

        const state: BootstrapState = Object.create(null);
        state.currentTeamId = streamThread.stream.teamId;
        state.currentUserId = this.session.userId;
        state.currentStreamId = streamThread.stream.id;
        state.selectedPostId = streamThread.id;
        state.streams = [streamThread.stream.entity];

        [state.posts, state.repos, state.teams, state.users] = await Promise.all([
            streamThread.stream.posts.entities(),
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

        this._panel.reveal(ViewColumn.Three, false);

        return this._streamThread;
    }
}
