"use strict";
import { Disposable, Event, EventEmitter, window } from "vscode";
import { Post, PostsReceivedEvent, StreamType } from "../api/session";
import { Notifications } from "../configuration";
import { Container } from "../container";
import { Arrays, Functions } from "../system";

export interface UnreadCountChangedEvent {
	getCount(): number;
}

export class NotificationsController implements Disposable {
	private _onDidChangeUnreadCount = new EventEmitter<UnreadCountChangedEvent>();
	get onDidChangeUnreadCount(): Event<UnreadCountChangedEvent> {
		return this._onDidChangeUnreadCount.event;
	}

	private _disposable: Disposable;
	private _count: number = 0;

	constructor() {
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

		const activeStream = Container.streamView.activeStreamThread;
		const streamVisible = Container.streamView.visible;

		let count = 0;
		if (Container.config.notifications !== Notifications.None) {
			for (const post of e.items()) {
				if (post.deleted || post.senderId === currentUserId) continue;

				const isPostStreamVisible =
					streamVisible &&
					!(activeStream === undefined || activeStream.stream.id !== post.streamId);
				if (!isPostStreamVisible) {
					count++;
				}

				switch (Container.config.notifications) {
					case Notifications.All:
						if (!isPostStreamVisible) {
							this.showNotification(post);
						} else if (
							post.mentioned(currentUsername) ||
							((await post.stream()).type === StreamType.Direct && !isPostStreamVisible)
						) {
							this.showNotification(post);
						}
						break;

					case Notifications.Mentions:
						if (
							post.mentioned(currentUsername) ||
							((await post.stream()).type === StreamType.Direct && !isPostStreamVisible)
						) {
							this.showNotification(post);
						}
						break;
				}
			}
		} else {
			count = Arrays.count(
				e.items(),
				p =>
					!p.deleted &&
					p.senderId !== currentUserId &&
					(!streamVisible || activeStream === undefined || activeStream.stream.id !== p.streamId)
			);
		}

		if (count === 0) return;

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

		// const actions: MessageItem[] = [
		//     { title: 'Open' }
		// ];

		const text = Container.linkActions.resolveTextTransformations(post.text);
		window.showInformationMessage(`${sender !== undefined ? sender.name : "Someone"}: ${text}`);
		// const result = await window.showInformationMessage(`${sender !== undefined ? sender.name : 'Someone'}: ${text}`, ...actions);
		// if (result === actions[0]) {
		//     Container.commands.openStream({ streamThread: { id: undefined, streamId: post.streamId } });
		// }
	}

	private _unreadCountChangedDebounced: ((e: UnreadCountChangedEvent) => void) | undefined;
	protected fireUnreadCountChanged(e: UnreadCountChangedEvent) {
		if (this._unreadCountChangedDebounced === undefined) {
			this._unreadCountChangedDebounced = Functions.debounce(
				(e: UnreadCountChangedEvent) => this._onDidChangeUnreadCount.fire(e),
				250
			);
		}
		this._unreadCountChangedDebounced(e);
	}
}
