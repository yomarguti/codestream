'use strict';
import { commands, Disposable, Extension, extensions, MessageItem, window, workspace } from 'vscode';
import { User } from '../api/session';
import { OpenStreamCommandArgs } from '../commands';
import { ContextKeys, setContext } from '../common';
import { Container } from '../container';

const liveShareRegex = /https:\/\/(?:.*?)liveshare(?:.*?).visualstudio.com\/join\?(.*?)(?:\s|$)/;
let liveShare: Extension<any> | undefined;

interface LiveShareActionData {
    url: string;
    sessionId: string;
    memberIds: string[];
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
            Container.linkActions.register<LiveShareActionData>('vsls', 'join', this.onRequestReceived, this)
        );

        const sessionId = this.sessionId;
        if (sessionId !== undefined) {
            const context = Container.context.globalState.get<LiveShareContext>(`vsls:${sessionId}`);
            if (context !== undefined) {
                this.openStream(sessionId, context.data.memberIds);
            }
        }
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
        return workspace.getConfiguration('vsliveshare').get<string>('join.reload.worskspaceId');
    }

    private async onRequestReceived(senderId: string, e: LiveShareActionData) {
        const match = liveShareRegex.exec(e.url);
        if (match == null) return;

        const [, sessionId] = match;
        const user = await Container.session.users.get(senderId);

        const actions: MessageItem[] = [
            { title: 'Join Live Share' },
            { title: 'Ignore', isCloseAffordance: true }
        ];

        const result = await window.showInformationMessage(`${user.name} is inviting you to join a Live Share session`, ...actions);
        if (result === undefined || result === actions[1]) return;

        await Container.context.globalState.update(`vsls:${sessionId}`, { senderId: senderId, data: e } as LiveShareContext);
        await commands.executeCommand('liveshare.join', e.url); // , { newWindow: true });
        // this.openStream(sessionId, e.memberIds);
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

        const link = Container.linkActions.toLinkAction<LiveShareActionData>('vsls', 'join', { url: url, sessionId: sessionId, memberIds: memberIds });
        await Container.session.post(`@${user.name} ${link}`);
    }

    async openStream(sessionId: string, memberIds: string[]) {
        await commands.executeCommand('codestream.openStream', {
            searchBy: memberIds,
            autoCreate: true
        } as OpenStreamCommandArgs);
    }
}