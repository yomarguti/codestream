"use strict";
import { Disposable, Event, EventEmitter, window } from "vscode";
import { Post, PostsReceivedEvent, StreamType } from "../api/session";
import { Notifications } from "../configuration";
import { Container } from "../container";
import { Arrays, Functions } from "../system";

export class NotificationsController implements Disposable {
	private _disposable: Disposable;

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

		if (Container.config.notifications !== Notifications.None) {
			for (const post of e.items()) {
				if (post.deleted || post.senderId === currentUserId) continue;

				const isPostStreamVisible =
					streamVisible &&
					!(activeStream === undefined || activeStream.stream.id !== post.streamId);

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
		}
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
}
