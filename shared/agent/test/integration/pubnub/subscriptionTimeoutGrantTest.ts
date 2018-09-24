"use strict";

import { expect } from "chai";
import { PubnubStatus, StatusChangeEvent } from "../../../src/pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class SubscriptionTimeoutGrantTest extends PubnubTester {
	private _didGetTrouble: boolean = false;

	describe() {
		return "when a subscription times out, a Granted event should be emitted indicating access was granted for the timed out channel";
	}

	run(): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (event.status === PubnubStatus.Trouble) {
				this._didGetTrouble = true;
			} else if (event.status === PubnubStatus.Granted && this._didGetTrouble) {
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
