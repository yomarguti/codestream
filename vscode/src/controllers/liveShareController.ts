'use strict';
import { commands, Disposable, MessageItem, window } from 'vscode';
import { PostsReceivedEvent, User } from '../api/session';
import { Container } from '../container';

// more 💩 code ahead

const liveShareRegex = /https:\/\/(?:.*?)liveshare(?:.*?).visualstudio.com\/join\?(.*?)(?:\s|$)/;

export class LiveShareController extends Disposable {

    private _disposable: Disposable;

    constructor() {
        super(() => this.dispose());

        this._disposable = Disposable.from(
            Container.session.onDidReceivePosts(this.onSessionPostsReceived, this)
        );
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    private async onSessionPostsReceived(e: PostsReceivedEvent) {
        const session = Container.session;
        const users = session.users;
        for (const post of e.getPosts()) {
            // if (post.senderId === session.user.id) continue;

            const match = liveShareRegex.exec(post.text);
            if (match != null) {
                const user = await users.get(post.senderId);

                const actions: MessageItem[] = [
                    { title: 'Join' },
                    { title: 'Ignore', isCloseAffordance: true }
                ];

                const result = await window.showInformationMessage(`${user.name} would like you to join a Live Share session. Would you like to join?`, ...actions);
                if (result === undefined || result === actions[1]) return;

                commands.executeCommand('liveshare.join', match[0]);
            }
        }
    }

    async invite(user: User) {
        const result = await commands.executeCommand('liveshare.start', true);
        if (result !== undefined) {
            Container.session.post(`@${user.name} ${result}`);
        }
    }
}