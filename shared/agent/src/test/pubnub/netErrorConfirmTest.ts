"use strict";

import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class NetErrorConfirmTest extends PubnubTester {

	private _didSubscribe: boolean = false;
	private _didConnect: boolean = false;
	private _didGetNetworkProblem: boolean = false;

	describe () {
		return "after subscribing, going offline, and coming online again, a Confirmed event should be emitted after confirming the subscription";
	}

	run (): Promise<void> {
		this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (
				event.status === PubnubStatus.Connected &&
				this._didSubscribe
			) {
				this._didConnect = true;
				this._pubnubConnection!.simulateNetError(1000);
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
		this.subscribeToUserChannel();
		this._didSubscribe = true;
		return promise;
	}
}