"use strict";
import { Disposable, window } from "vscode";
import { Post, PostsReceivedEvent, StreamType } from "../api/session";
import { Notifications } from "../configuration";
import { Container } from "../container";

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
		const currentUser = Container.session.user;
		const currentUserId = currentUser.id;
		const currentUsername = currentUser.name;

		const activeStream = Container.streamView.activeStreamThread;
		const streamVisible = Container.streamView.visible;

		if (Container.config.notifications === Notifications.None) return;

		for (const post of e.items()) {
			if (post.deleted || post.senderId === currentUserId) continue;

			const mentioned = post.mentioned(currentUsername);
			// If we are muted and not mentioned, skip it
			if (currentUser.hasMutedChannel(post.streamId) && !mentioned) continue;

			const isPostStreamVisible =
				streamVisible && !(activeStream === undefined || activeStream.stream.id !== post.streamId);

			switch (Container.config.notifications) {
				case Notifications.All:
					if (!isPostStreamVisible) {
						this.showNotification(post);
					} else if (
						mentioned ||
						(!isPostStreamVisible && (await post.stream()).type === StreamType.Direct)
					) {
						this.showNotification(post);
					}
					break;

				case Notifications.Mentions:
					if (
						mentioned ||
						(!isPostStreamVisible && (await post.stream()).type === StreamType.Direct)
					) {
						this.showNotification(post);
					}
					break;
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
