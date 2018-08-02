"use strict";

import { expect } from "chai";
import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class SubscriptionTimeoutQueueTest extends PubnubTester {
	private _didGetTrouble: boolean = false;
	private _didGetGranted: boolean = false;
	private _didGetQueued: boolean = false;

	describe() {
		return "when a subscription times out, and a new request to subscribe to a channel comes in while still recovering, the new request should get queued, and a Connected event should be emiited indicating both channels are subscribed";
	}

	async before() {
		await super.before();
		await this.createTeamAndStream();
	}

	run(): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (event.status === PubnubStatus.Trouble) {
				this._didGetTrouble = true;
				setTimeout(() => {
					this.subscribeToStreamChannel();
				}, 0);
			} else if (event.status === PubnubStatus.Queued && this._didGetTrouble) {
				this._didGetQueued = true;
			} else if (event.status === PubnubStatus.Granted && this._didGetQueued) {
				this._didGetGranted = true;
			} else if (event.status === PubnubStatus.Connected && this._didGetGranted) {
				event.channels!.sort();
				expect(event.channels).to.deep.equal([
					`stream-${this._streamData!._id}`,
					`user-${this._userData!.user._id}`
				]);
				this._resolve();
			} else {
				this._reject("unexpected connection status: " + event.status);
			}
		});
		const promise = super.run();
		this._pubnubConnection!.simulateSubscriptionTimeout();
		this.subscribeToUserChannel();
		return promise;
	}
}
