"use strict";

import { expect } from "chai";
import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class QueuedChannelsTest extends PubnubTester {

	private _didSubscribe: boolean = false;
	private _didQueue: boolean = false;

	describe () {
		return "after subscribing to a first channel (and before the subscription is complete), additional channels subscribed to should be cleared and then subscribed to after the first completes";
	}

	async before () {
		await super.before();
		await this.createTeamAndStream();
	}

	run (): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (
				event.status === PubnubStatus.Queued &&
				!this._didQueue
			) {
				expect(event.channels).to.deep.equal([`stream-${this._streamData!._id}`]);
				this._didQueue = true;
			}
			else if (
				event.status === PubnubStatus.Connected &&
				this._didSubscribe &&
				this._didQueue
			) {
				event.channels!.sort();
				expect(event.channels).to.deep.equal([`stream-${this._streamData!._id}`, `user-${this._userData!.user._id}`]);
				this._resolve();
			}
			else {
				this._reject("receiver status should be Connected, was " + event.status);
			}
		});
		const promise = super.run();
		this.subscribeToUserChannel();
		this.subscribeToStreamChannel();
		this._didSubscribe = true;
		return promise;
	}
}
