"use strict";

import { BroadcasterStatus, BroadcasterStatusType } from "../../../src/broadcaster/broadcaster";
import { BroadcasterTester } from "./broadcasterTester";

export class MessageTest extends BroadcasterTester {
	describe() {
		return "should be able to receive messages after subscribing to a Pubnub channel";
	}

	async before() {
		await super.before();
		await this.createTeamAndStream();
	}

	run(): Promise<void> {
		this._statusListener = this._broadcaster!.onDidStatusChange((event: BroadcasterStatus) => {
			if (event.status === BroadcasterStatusType.Connected) {
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
		this._messageListener = this._broadcaster!.onDidReceiveMessages((messages: any[]) => {
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
