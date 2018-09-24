"use strict";

import { PubnubStatus, StatusChangeEvent } from "../../../src/pubnub/pubnubConnection";
import { PubnubTester, PubnubTesterConfig } from "./pubnubTester";

export class StartOfflineTest extends PubnubTester {
	constructor(config: PubnubTesterConfig) {
		super(config);
		this._startOffline = true;
	}

	describe(): string {
		return "when subscribing while offline, an Offline event should be emitted";
	}

	run(): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (event.status === PubnubStatus.Offline) {
				this._resolve();
			} else {
				this._reject("connection status should be Offline, was " + event.status);
			}
		});
		const promise = super.run();
		this.subscribeToUserChannel();
		return promise;
	}
}
