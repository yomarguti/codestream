"use strict";

import { expect } from "chai";
import * as Randomstring from "randomstring";
import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class InvalidChannelTest extends PubnubTester {

	private _invalidChannel: string | undefined;
	private _didGetTrouble: boolean = false;
	private _didGetFailed: boolean = false;

	describe () {
		return "subscription to an invalid channel should be rejected";
	}

	run (): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (
				event.status === PubnubStatus.Trouble
			) {
				if (!this._didGetTrouble) {
					expect(event.channels).to.deep.equal([this._invalidChannel]);
					this._didGetTrouble = true;
				}
			}
			else if (
				event.status === PubnubStatus.Failed &&
				this._didGetTrouble
			) {
				if (!this._didGetFailed) {
					expect(event.channels).to.deep.equal([this._invalidChannel]);
					this._didGetFailed = true;
				}
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
		this._invalidChannel = this.getInvalidChannelName();
		this._pubnubConnection!.subscribe([`user-${this._userData!.user._id}`, this._invalidChannel]);
		return promise;
	}

	getInvalidChannelName () {
		return `user-${Randomstring.generate(24)}`;
	}
}
