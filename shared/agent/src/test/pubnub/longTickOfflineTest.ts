"use strict";

import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester, PubnubTesterConfig } from "./pubnubTester";

export class LongTickOfflineTest extends PubnubTester {
	private _didSeeFirstOffline: boolean = false;

	constructor(config: PubnubTesterConfig) {
		super(config);
		this._testTimeout = 15000;
	}

	describe() {
		return "when execution stops for longer than 10 seconds, and we went offline during that time, an Offline event should be emitted when resuming execution (simulates laptop sleep)";
	}

	run(): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (event.status === PubnubStatus.Connected) {
				this._pubnubConnection!.simulateLongTick();
				this._pubnubConnection!.setOnline(false);
			} else if (event.status === PubnubStatus.Offline) {
				if (this._didSeeFirstOffline) {
					this._resolve();
				} else {
					this._didSeeFirstOffline = true;
				}
			} else if (event.status !== PubnubStatus.NetworkProblem) {
				this._reject("unexpected connection status: " + event.status);
			}
		});
		const promise = super.run();
		setTimeout(this.subscribeToUserChannel.bind(this), 2000); // wait for at least one tick
		return promise;
	}
}
