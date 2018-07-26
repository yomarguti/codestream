"use strict";

import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class NetErrorTest extends PubnubTester {

	private _didConnect: boolean = false;

	describe () {
		return "when a network error is detected, a NetworkProblem event should be emitted";
	}

	run (): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (event.status === PubnubStatus.Connected) {
				this._didConnect = true;
				this._pubnubConnection!.simulateNetError(1000);
			}
			else if (
				event.status === PubnubStatus.NetworkProblem &&
				this._didConnect
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