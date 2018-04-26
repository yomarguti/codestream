'use strict';
import { commands, Disposable, Extension, extensions, MessageItem, window, workspace } from 'vscode';
import { Post, SessionStatus, SessionStatusChangedEvent, User } from '../api/session';
import { OpenStreamCommandArgs } from '../commands';
import { ContextKeys, setContext } from '../common';
import { Container } from '../container';
import { Iterables } from '../system';
import { RemoteGitService, RemoteRepository } from '../git/remoteGitService';
import { Logger } from '../logger';

const liveShareRegex = /https:\/\/(?:.*?)liveshare(?:.*?).visualstudio.com\/join\?(.*?)(?:\s|$)/;
let liveShare: Extension<any> | undefined;

interface LiveShareActionData {
    url: string;
    sessionId: string;
    memberIds: string[];
    repos: RemoteRepository[];
}

interface LiveShareContext {
    senderId: string;
    data: LiveShareActionData;
}

export class LiveShareController extends Disposable {

    static ensureLiveShare(): boolean {
        if (liveShare === undefined) {
            liveShare = extensions.getExtension('ms-vsliveshare.vsliveshare');
        }
        return liveShare !== undefined;
    }

    private readonly _disposable: Disposable | undefined;

    constructor() {
        super(() => this.dispose());

        if (!LiveShareController.ensureLiveShare()) return;

        setContext(ContextKeys.LiveShareInstalled, true);

        this._disposable = Disposable.from(
            Container.session.onDidChangeStatus(this.onSessionStatusChanged, this),
            Container.linkActions.register<LiveShareActionData>('vsls', 'join', this.onRequestReceived, this)
        );
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    get isInstalled() {
        return liveShare !== undefined;
    }

    // get inRemoteSession() {
    //     return this.sessionId !== undefined;
    // }

    get sessionId() {
        return workspace.getConfiguration('vsliveshare').get<string>('join.reload.workspaceId');
    }

    private async onRequestReceived(post: Post, e: LiveShareActionData) {
        const match = liveShareRegex.exec(e.url);
        if (match == null) return;

        const [, sessionId] = match;
        const sender = await post.sender();
        if (sender === undefined) {
            debugger;
            return;
        }

        // Only notify if we've been mentioned
        if (!post.mentioned(Container.session.user.name)) return;

        const actions: MessageItem[] = [
            { title: 'Join Live Share' },
            { title: 'Ignore', isCloseAffordance: true }
        ];

        const result = await window.showInformationMessage(`${sender.name} is inviting you to join a Live Share session`, ...actions);
        if (result === undefined || result === actions[1]) return;

        await Container.context.globalState.update(`vsls:${sessionId}`, { senderId: post.senderId, data: e } as LiveShareContext);
        await commands.executeCommand('liveshare.join', e.url); // , { newWindow: true });
        // this.openStream(sessionId, e.memberIds);
    }

    private onSessionStatusChanged(e: SessionStatusChangedEvent) {
        const sessionId = this.sessionId;
        // If we aren't in an active (remote) live share session kick out
        if (sessionId === undefined) return;

        const status = e.getStatus();
        if (status === SessionStatus.SignedOut) return;

        const context = Container.context.globalState.get<LiveShareContext>(`vsls:${sessionId}`);
        if (context === undefined) {
            Logger.warn('Unable to find live share context');
            return;
        }

        switch (status) {
            case SessionStatus.SigningIn:
                // Since we are in a live share session, swap out our git service
                Container.overrideGit(new RemoteGitService(context.data.repos));
                break;

            case SessionStatus.SignedIn:
                // When we are signed in, open a channel for the liveshare
                this.openStream(sessionId, context.data.memberIds);
                break;
        }
    }

    async invite(user: User) {
        if (!this.isInstalled) throw new Error('Live Share is not installed');

        const result = await commands.executeCommand('liveshare.start', { suppressNotification: true });
        if (result === undefined) return;

        const match = liveShareRegex.exec(result.toString());
        if (match == null) return;

        const [url, sessionId] = match;
        const memberIds = [Container.session.userId, user.id];
        this.openStream(sessionId, memberIds);

        const repos = Iterables.map(await Container.session.repos.items(), r => ({ id: r.id, hash: r.hash, normalizedUrl: r.normalizedUrl, url: r.url } as RemoteRepository));

        const link = Container.linkActions.toLinkAction<LiveShareActionData>('vsls', 'join', { url: url, sessionId: sessionId, memberIds: memberIds, repos: [...repos] });
        await Container.session.post(`@${user.name} ${link}`);
    }

    private async openStream(sessionId: string, memberIds: string[]) {
        await commands.executeCommand('codestream.openStream', {
            searchBy: memberIds,
            autoCreate: true
        } as OpenStreamCommandArgs);
    }
}