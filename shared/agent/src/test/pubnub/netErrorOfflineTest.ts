"use strict";

import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class NetErrorOfflineTest extends PubnubTester {

	private _didSeeFirstOffline: boolean = false;

	describe () {
		return "when a network error is detected, and we've gone offline, an Offline event should be emitted";
	}

	run (): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (event.status === PubnubStatus.Connected) {
				this._pubnubConnection!.simulateNetError(1000);
				this._pubnubConnection!.setOnline(false);
			}
			else if (event.status === PubnubStatus.Offline) {
				if (this._didSeeFirstOffline) {
					this._resolve();
				}
				else {
					this._didSeeFirstOffline = true;
				}
			}
			else if (event.status !== PubnubStatus.NetworkProblem) {
				this._reject("unexpected connection status: " + event.status);
			}
		});
		const promise = super.run();
		this.subscribeToUserChannel();
		return promise;
	}
}
