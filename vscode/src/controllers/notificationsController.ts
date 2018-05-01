'use strict';
import { Disposable, Event, EventEmitter, window } from 'vscode';
import { Post, PostsReceivedEvent, StreamType } from '../api/session';
import { Notifications } from '../config';
import { Container } from '../container';
import { Arrays, Functions } from '../system';

// total 💩 code ahead

export interface UnreadCountChangedEvent {
    getCount(): number;
}

export class NotificationsController extends Disposable {

    private _onDidChangeUnreadCount = new EventEmitter<UnreadCountChangedEvent>();
    get onDidChangeUnreadCount(): Event<UnreadCountChangedEvent> {
        return this._onDidChangeUnreadCount.event;
    }

    private _disposable: Disposable;
    private _count: number = 0;

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
        const currentUserId = Container.session.userId;
        const currentUsername = Container.session.user.name;

        let count = 0;
        if (Container.config.notifications !== Notifications.None) {
            for (const post of e.items()) {
                if (post.senderId === currentUserId) continue;

                count++;
                switch (Container.config.notifications) {
                    case Notifications.All:
                        this.showNotification(post);
                        break;

                    case Notifications.Mentions:
                        if (post.mentioned(currentUsername) || (await post.stream()).type === StreamType.Direct) {
                            this.showNotification(post);
                        }
                        break;
                }
            }
        }
        else {
            count = Arrays.count(e.items(), p => p.senderId !== currentUserId);
        }

        // 💩💩💩 need to keep track of a lot more
        this._count += count;
        this.fireUnreadCountChanged({
            getCount: () => this._count
        });
    }

    clearUnreadCount() {
        this._count = 0;
        this.fireUnreadCountChanged({
            getCount: () => this._count
        });
    }

    async showNotification(post: Post) {
        const sender = await post.sender();
        await window.showInformationMessage(`${sender !== undefined ? sender.name : 'Someone'}: ${post.text}`);
    }

    private _unreadCountChangedDebounced: ((e: UnreadCountChangedEvent) => void) | undefined;
    protected fireUnreadCountChanged(e: UnreadCountChangedEvent) {
        if (this._unreadCountChangedDebounced === undefined) {
            this._unreadCountChangedDebounced = Functions.debounce((e: UnreadCountChangedEvent) => this._onDidChangeUnreadCount.fire(e), 250);
        }
        this._unreadCountChangedDebounced(e);
    }
}