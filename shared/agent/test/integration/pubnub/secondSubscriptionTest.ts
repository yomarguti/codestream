"use strict";

import { expect } from "chai";
import { PubnubStatus, StatusChangeEvent } from "../../../src/pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class SecondSubscriptionTest extends PubnubTester {
	private _didSubscribe: boolean = false;
	private _firstConnected: boolean = false;

	describe() {
		return "user should be able to successfully subscribe to a second channel after subscribing to their own me-channel";
	}

	async before() {
		await super.before();
		await this.createTeamAndStream();
	}

	run(): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (event.status === PubnubStatus.Connected && this._didSubscribe && !this._firstConnected) {
				this._firstConnected = true;
				setTimeout(() => {
					this.subscribeToStreamChannel();
				}, 0);
			} else if (event.status === PubnubStatus.Connected && this._firstConnected) {
				event.channels!.sort();
				expect(event.channels).to.deep.equal([
					`stream-${this._streamData!._id}`,
					`user-${this._userData!.user._id}`
				]);
				this._resolve();
			} else {
				this._reject("receiver status should be Connected, was " + event.status);
			}
		});
		const promise = super.run();
		this.subscribeToUserChannel();
		this._didSubscribe = true;
		return promise;
	}
}
