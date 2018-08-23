"use strict";
import { Disposable, MessageItem, window } from "vscode";
import { Post, PostsReceivedEvent, StreamType } from "../api/session";
import { Notifications } from "../configuration";
import { Container } from "../container";
import { vslsUrlRegex } from "./liveShareController";

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
		const activeStream = Container.streamView.activeStreamThread;
		const streamVisible = Container.streamView.visible;

		if (Container.config.notifications === Notifications.None) return;

		for (const post of e.items()) {
			if (post.deleted || post.senderId === currentUser.id) continue;

			const mentioned = post.mentioned(currentUser.id);
			// If we are muted and not mentioned, skip it
			if (currentUser.hasMutedChannel(post.streamId) && !mentioned) continue;

			const isPostStreamVisible =
				streamVisible && !(activeStream === undefined || activeStream.stream.id !== post.streamId);

			switch (Container.config.notifications) {
				case Notifications.All:
					if (!isPostStreamVisible) {
						this.showNotification(post, false);
					} else if (
						mentioned ||
						(!isPostStreamVisible && (await post.stream()).type === StreamType.Direct)
					) {
						this.showNotification(post, true);
					}
					break;

				case Notifications.Mentions:
					if (
						mentioned ||
						(!isPostStreamVisible && (await post.stream()).type === StreamType.Direct)
					) {
						this.showNotification(post, true);
					}
					break;
			}
		}
	}

	async showNotification(post: Post, mentioned: boolean) {
		const sender = await post.sender();

		const text = post.text;
		if (mentioned && sender !== undefined) {
			const match = vslsUrlRegex.exec(text);
			if (match != null) {
				const actions: MessageItem[] = [
					{ title: "Join Live Share" },
					{ title: "Ignore", isCloseAffordance: true }
				];

				const result = await window.showInformationMessage(
					`${sender.name} is inviting you to join a Live Share session`,
					...actions
				);

				if (result === actions[0]) {
					Container.vsls.join({ url: match[0] });
				}

				return;
			}
		}

		// const actions: MessageItem[] = [
		//     { title: 'Open' }
		// ];

		await window.showInformationMessage(
			`${sender !== undefined ? sender.name : "Someone"}: ${post.text}`
		);
		// const result = await window.showInformationMessage(`${sender !== undefined ? sender.name : 'Someone'}: ${text}`, ...actions);
		// if (result === actions[0]) {
		//     Container.commands.openStream({ streamThread: { id: undefined, streamId: post.streamId } });
		// }
	}
}
