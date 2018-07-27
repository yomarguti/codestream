"use strict";

import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class CatchUpTest extends PubnubTester {

	private _didSubscribe: boolean = false;
	private _didConnect: boolean = false;
	private _didGoOnline: boolean = false;

	async before () {
		await super.before();
		await this.createTeamAndStream();
	}

	describe () {
		return "messages missed while offline should be received after going online";
	}

	run (): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (
				event.status === PubnubStatus.Connected &&
				this._didSubscribe &&
				!this._didGoOnline
			) {
				this._didConnect = true;
				// create a first post, this sets the last message received to something, which
				// will cause the catch-up after the second comes in while offline
				this.createPost({ token: this._otherUserData!.accessToken });
			}
			else if (
				event.status === PubnubStatus.Connected &&
				this._didGoOnline
			) {
			}
			else if (
				event.status === PubnubStatus.Offline &&
				this._didConnect
			) {
				setTimeout(() => {
					this._didGoOnline = true;
					this._pubnubConnection!.simulateOffline(false);
					this._pubnubConnection!.setOnline(true);
				}, 2000);
			}
			else if (
				event.status === PubnubStatus.Confirmed &&
				this._didGoOnline
			) {
			}
			else {
				this._reject("unexpected connection status: " + event.status);
			}
		});
		const promise = super.run();
		this.listenForMessage();
		this.subscribeToStreamChannel();
		this._didSubscribe = true;
		return promise;
	}

	listenForMessage () {
		this._messageListener = this._pubnubConnection!.onDidReceiveMessages((messages: any[]) => {
			if (
				!this._didGoOnline &&
				messages.length === 1 &&
				messages[0].post &&
				messages[0].post._id === this._postData!._id
			) {
				this._pubnubConnection!.simulateOffline();
				this._pubnubConnection!.setOnline(false);
				this.createPost({ token: this._otherUserData!.accessToken });
			}
			else if (
				this._didGoOnline &&
				messages.find(message => message.post && message.post._id === this._postData!._id)
			) {
				this._resolve();
			}
		});
	}
}
