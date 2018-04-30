'use strict';
import { Disposable, Event, EventEmitter, Range, ViewColumn, WebviewPanel, WebviewPanelOnDidChangeViewStateEvent, window } from 'vscode';
import { CSPost, CSRepository, CSStream, CSTeam, CSUser } from '../api/api';
import { CodeStreamSession, Post, PostsReceivedEvent, SessionChangedEvent, SessionChangedType, Stream, StreamThread } from '../api/session';
import { isStreamThread } from '../commands';
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
    selectedMarker?: { postId: string };
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

    private onPanelViewStateChanged(e: WebviewPanelOnDidChangeViewStateEvent) {
        Logger.log('WebView.ViewStateChanged', e);
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

                        Container.commands.openPostWorkingFile(new Post(this.session, body.payload, this._streamThread.stream));
                        return;

                    case 'thread-selected':
                        const { threadId, streamId } = body.payload;
                        if (this._streamThread !== undefined && this._streamThread.stream.id === streamId) {
                            this._streamThread.id = threadId;
                        }
                        return;
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

    is(stream: Stream): boolean;
    is(streamThread: StreamThread): boolean;
    is(streamOrThread: Stream | StreamThread) {
        if (this._streamThread === undefined) return false;

        if (isStreamThread(streamOrThread)) {
            return this._streamThread.stream.id === streamOrThread.stream.id && this._streamThread.id === streamOrThread.id;
        }

        return this._streamThread.stream.id === streamOrThread.id;
    }

    post(text: string) {
        return this.postMessage({
            type: 'ui-data',
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
            type: 'ui-data',
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

    async setStream(streamThread: StreamThread): Promise<StreamThread> {
        // TODO: Consider threadId when showing streams (allow to jumping right into a thread)
        if (this._streamThread && this._streamThread.id === streamThread.stream.id) {
            this.show();

            return this._streamThread;
        }

        const label = await streamThread.stream.label();
        this._panel.title = `${label} \u00a0\u2022\u00a0 CodeStream`;
        this._streamThread = streamThread;

        const state: BootstrapState = Object.create(null);
        state.currentTeamId = streamThread.stream.teamId;
        state.currentUserId = this.session.userId;
        state.currentStreamId = streamThread.stream.id;
        state.selectedMarker = undefined; // { postId: '5ae34c8d50835847496a406b' };  // used to display thread
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

        this.show();

        return this._streamThread;
    }

    show() {
        this._panel.reveal(ViewColumn.Three);
    }

    private postMessage(request: CSWebviewRequest) {
        return this._panel.webview.postMessage(request);
    }
}
