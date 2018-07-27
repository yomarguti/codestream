"use strict";

import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester, PubnubTesterConfig } from "./pubnubTester";

export class LongTickConfirmTest extends PubnubTester {

	private _didSubscribe: boolean = false;
	private _didConnect: boolean = false;
	private _didGetNetworkProblem: boolean = false;

	constructor (config: PubnubTesterConfig) {
		super(config);
		this._testTimeout = 15000;
	}

	describe () {
		return "after subscribing, going offline with a long tick, and coming online again, a Confirmed event should be emitted after confirming the subscription";
	}

	run (): Promise<void> {
		this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (
				event.status === PubnubStatus.Connected &&
				this._didSubscribe
			) {
				this._didConnect = true;
				this._pubnubConnection!.simulateLongTick();
			}
			else if (
				event.status === PubnubStatus.NetworkProblem &&
				this._didConnect
			) {
				this._didGetNetworkProblem = true;
			}
			else if (
				event.status === PubnubStatus.Confirmed &&
				this._didGetNetworkProblem
			) {
				this._resolve();
			}
			else {
				this._reject("unexpected connection status: " + event.status);
			}
		});
		const promise = super.run();
		setTimeout(this.subscribeToUserChannel.bind(this), 2000);	// wait for at least one tick
		this._didSubscribe = true;
		return promise;
	}
}