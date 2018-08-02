"use strict";

import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester, PubnubTesterConfig } from "./pubnubTester";

export class GoOnlineTest extends PubnubTester {
	private _didSeeOffline: boolean = false;
	private _didSubscribe: boolean = false;

	constructor(config: PubnubTesterConfig) {
		super(config);
		this._startOffline = true;
	}

	describe() {
		return "when subscribing while offline, a Connected event should only be emitted after going online again";
	}

	run(): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (event.status === PubnubStatus.Offline) {
				if (this._didSeeOffline) {
					this._reject("saw Offline event twice");
				} else {
					this._didSeeOffline = true;
				}
			} else if (event.status === PubnubStatus.Queued) {
			} else if (
				event.status === PubnubStatus.Connected &&
				this._didSeeOffline &&
				this._didSubscribe
			) {
				this._resolve();
			} else {
				this._reject("unexpected connection status: " + event.status);
			}
		});
		const promise = super.run();
		this.subscribeToUserChannel();
		this._didSubscribe = true;
		this._pubnubConnection!.setOnline(true);
		return promise;
	}
}
