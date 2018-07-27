"use strict";

import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester, PubnubTesterConfig } from "./pubnubTester";

export class LongTickTest extends PubnubTester {

	private _didConnect: boolean = false;

	constructor (config: PubnubTesterConfig) {
		super(config);
		this._testTimeout = 15000;
	}

	describe () {
		return "when execution stops for longer than 10 seconds, a NetworkProblem event should be emitted when resuming execution (simulates laptop sleep)";
	}

	run (): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (event.status === PubnubStatus.Connected) {
				this._didConnect = true;
				this._pubnubConnection!.simulateLongTick();
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
		setTimeout(this.subscribeToUserChannel.bind(this), 2000);	// wait for at least one tick
		return promise;
	}
}
