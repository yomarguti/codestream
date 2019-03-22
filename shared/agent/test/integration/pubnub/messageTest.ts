"use strict";

import { MessagerStatus, MessagerStatusType } from "../../../src/messager/messager";
import { MessagerTester } from "./messagerTester";

export class MessageTest extends MessagerTester {
	describe() {
		return "should be able to receive messages after subscribing to a Pubnub channel";
	}

	async before() {
		await super.before();
		await this.createTeamAndStream();
	}

	run(): Promise<void> {
		this._statusListener = this._messager!.onDidStatusChange((event: MessagerStatus) => {
			if (event.status === MessagerStatusType.Connected) {
				this.createPost({ token: this._otherUserData!.accessToken });
			} else {
				this._reject("unexpected connection status: " + event.status);
			}
		});
		const promise = super.run();
		this.listenForMessage();
		this.subscribeToStreamChannel();
		return promise;
	}

	listenForMessage() {
		this._messageListener = this._messager!.onDidReceiveMessages((messages: any[]) => {
			if (
				messages.length === 1 &&
				messages[0].post &&
				messages[0].post._id === this._postData!._id
			) {
				this._resolve();
			}
		});
	}
}
