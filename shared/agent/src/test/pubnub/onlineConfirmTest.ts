"use strict";

import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class OnlineConfirmTest extends PubnubTester {
	private _didSeeOffline: boolean = false;
	private _didGoOnline: boolean = false;
	private _didSubscribe: boolean = false;

	describe() {
		return "after subscribing, going offline, and coming online again, a Confirmed event should be emitted after confirming the subscription";
	}

	run(): Promise<void> {
		this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (event.status === PubnubStatus.Confirmed && this._didSubscribe && this._didGoOnline) {
				this._resolve();
			} else if (
				event.status === PubnubStatus.Connected &&
				this._didSubscribe &&
				!this._didGoOnline
			) {
				this._pubnubConnection!.setOnline(false);
				setTimeout(() => {
					this._pubnubConnection!.setOnline(true);
					this._didGoOnline = true;
				}, 1000);
			} else if (event.status === PubnubStatus.Offline) {
				if (this._didSeeOffline) {
					this._reject("saw Offline event twice");
				} else {
					this._didSeeOffline = true;
				}
			} else {
				this._reject("unexpected connection status: " + event.status);
			}
		});
		const promise = super.run();
		this.subscribeToUserChannel();
		this._didSubscribe = true;
		return promise;
	}
}
