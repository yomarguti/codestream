"use strict";

import { expect } from "chai";
import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester, PubnubTesterConfig } from "./pubnubTester";

export class InvalidAuthKeyTest extends PubnubTester {

	private _didGetTrouble: boolean = false;
	private _didGetGranted: boolean = false;

	constructor (config: PubnubTesterConfig) {
		super(config);
		this._pubnubToken = "hello";
		this._testTimeout = 20000;
	}

	describe () {
		return "if an invalid Pubnub token is provided, subscriptions should fail and an Aborted event should be emitted";
	}

	run (): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (
				event.status === PubnubStatus.Trouble
			) {
				expect(event.channels).to.deep.equal([`user-${this._userData!.user._id}`]);
				this._didGetTrouble = true;
			}
			else if (
				event.status === PubnubStatus.Granted &&
				this._didGetTrouble
			) {
				expect(event.channels).to.deep.equal([`user-${this._userData!.user._id}`]);
				this._didGetGranted = true;
			}
			else if (
				event.status === PubnubStatus.Aborted &&
				this._didGetGranted
			) {
				this._resolve();
			}
			else {
				this._reject("unexpected connection status: " + event.status);
			}
		});
		const promise = super.run();
		this.subscribeToUserChannel();
		return promise;
	}
}
