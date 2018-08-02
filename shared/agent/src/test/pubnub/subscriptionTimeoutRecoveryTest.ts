"use strict";

import { expect } from "chai";
import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class SubscriptionTimeoutRecoveryTest extends PubnubTester {
	private _didGetTrouble: boolean = false;
	private _didGetGranted: boolean = false;

	describe() {
		return "when a subscription times out, after requesting a grant from the server, a Connected event should be emitted indicating the channel was subscribed to successfully";
	}

	run(): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (event.status === PubnubStatus.Trouble) {
				this._didGetTrouble = true;
			} else if (event.status === PubnubStatus.Granted && this._didGetTrouble) {
				this._didGetGranted = true;
			} else if (event.status === PubnubStatus.Connected && this._didGetGranted) {
				expect(event.channels).to.deep.equal([`user-${this._userData!.user._id}`]);
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
