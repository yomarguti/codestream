'use strict';
import { Disposable, Event, EventEmitter, Range, Uri, ViewColumn, WebviewPanel, WebviewPanelOnDidChangeViewStateEvent, window, workspace } from 'vscode';
import { CSPost, CSRepository, CSStream, CSTeam, CSUser } from '../api/api';
import { CodeStreamSession, Post, PostsReceivedEvent, SessionChangedEvent, SessionChangedType, StreamThread, StreamType } from '../api/session';
import { Container } from '../container';
import { Logger } from '../logger';
import * as fs from 'fs';

interface BootstrapState {
    currentTeamId: string;
    currentUserId: string;
    currentStreamId: string;
    currentStreamLabel?: string;
    currentStreamServiceType?: 'liveshare';
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

    private _disposable: Disposable | undefined;
    private _panel: WebviewPanel | undefined;
    private _streamThread: StreamThread | undefined;

    constructor(
        public readonly session: CodeStreamSession
    ) {
        super(() => this.dispose());
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
                // TODO: Add sequence ids to ensure correct matching
                // TODO: Add exception handling for failed requests
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
            this._panel!.reveal(undefined, false);

            return this._streamThread;
        }

        return this.setStream(streamThread);
    }

    private async getHtml(): Promise<string> {
        if (Logger.isDebugging) {
            return new Promise<string>((resolve, reject) => {
                fs.readFile(Container.context.asAbsolutePath('/assets/index.html'), 'utf8', (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(data);
                    }
                });
            });
        }

        const doc = await workspace.openTextDocument(Container.context.asAbsolutePath('/assets/index.html'));
        return doc.getText();
    }

    private async postMessage(request: CSWebviewRequest) {
        const success = await this._panel!.webview.postMessage(request);
        if (!success) {
            this._invalidateOnVisible = true;
        }
    }

    private async setStream(streamThread: StreamThread): Promise<StreamThread> {
        this._streamThread = streamThread;

        const [label, content, posts, repos, teams, users] = await Promise.all([
            streamThread.stream.label(),
            this.getHtml(),
            streamThread.stream.posts.entities(),
            this.session.repos.entities(),
            this.session.teams.entities(),
            this.session.users.entities()
        ]);

        const state: BootstrapState = Object.create(null);
        state.currentTeamId = streamThread.stream.teamId;
        state.currentUserId = this.session.userId;
        state.currentStreamId = streamThread.stream.id;
        if (streamThread.stream.type === StreamType.Channel) {
            if (streamThread.stream.isLiveShareChannel) {
                state.currentStreamLabel = label;
                state.currentStreamServiceType = 'liveshare';
            }
        }
        state.selectedPostId = streamThread.id;

        state.posts = posts;
        state.repos = repos;
        state.streams = [streamThread.stream.entity];
        state.teams = teams;
        state.users = users;

        const html = content
            .replace(/{{root}}/g, Uri.file(Container.context.asAbsolutePath('.')).with({ scheme: 'vscode-resource' }).toString())
            .replace('\'{{bootstrap}}\'', JSON.stringify(state));

        if (this._panel === undefined) {
            this._panel = window.createWebviewPanel(
                'CodeStream.stream',
                `${label} \u00a0\u2022\u00a0 CodeStream`,
                { viewColumn: ViewColumn.Three, preserveFocus: false },
                {
                    retainContextWhenHidden: true,
                    enableFindWidget: true,
                    enableCommandUris: true,
                    enableScripts: true
                }
            );

            this._disposable = Disposable.from(
                this.session.onDidReceivePosts(this.onPostsReceived, this),
                this.session.onDidChange(this.onSessionChanged, this),
                this._panel,
                this._panel.onDidDispose(this.onPanelDisposed, this),
                this._panel.onDidChangeViewState(this.onPanelViewStateChanged, this),
                this._panel.webview.onDidReceiveMessage(this.onPanelWebViewMessageReceived, this)
            );

            this._panel.webview.html = html;
        }
        else {
            this._panel.title = `${label} \u00a0\u2022\u00a0 CodeStream`;
            this._panel.webview.html = html;
            this._panel.reveal(ViewColumn.Three, false);
        }

        return this._streamThread;
    }
}
