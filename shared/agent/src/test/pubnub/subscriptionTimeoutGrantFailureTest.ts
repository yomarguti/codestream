"use strict";

import { expect } from "chai";
import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class SubscriptionTimeoutGrantFailureTest extends PubnubTester {

	private _didGetTrouble: boolean = false;
	private _didGetFailed: boolean = false;

	describe () {
		return "when a subscription times out, an a channel is not granted access, that channel should be removed from the list of channels to subscribe to, and subscription of other channels should proceed with success and an emitted Connected event";
	}

	async before () {
		await super.before();
		await this.createTeamAndStream();
	}

	run (): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (
				event.status === PubnubStatus.Trouble &&
				!this._didGetTrouble
			) {
				this._didGetTrouble = true;
			}
			else if (
				event.status === PubnubStatus.Failed &&
				this._didGetTrouble
			) {
				expect(event.channels).to.deep.equal([`stream-${this._streamData!._id}`]);
				this._didGetFailed = true;
			}
			else if (
				event.status === PubnubStatus.Connected &&
				this._didGetFailed
			) {
				expect(event.channels).to.deep.equal([`user-${this._userData!.user._id}`]);
				this._resolve();
			}
			else {
				this._reject("unexpected connection status: " + event.status);
			}
		});
		const promise = super.run();
		this._pubnubConnection!.simulateSubscriptionTimeout();
		this._pubnubConnection!.simulateGrantFailure(`stream-${this._streamData!._id}`);
		this._pubnubConnection!.subscribe([`user-${this._userData!.user._id}`, `stream-${this._streamData!._id}`]);
		return promise;
	}
}