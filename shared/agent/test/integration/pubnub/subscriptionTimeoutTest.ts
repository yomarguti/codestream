"use strict";

import { expect } from "chai";
import { PubnubStatus, StatusChangeEvent } from "../../../src/pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class SubscriptionTimeoutTest extends PubnubTester {
	describe() {
		return "when a subscription times out, a Trouble event should be emitted";
	}

	run(): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (event.status === PubnubStatus.Trouble) {
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
