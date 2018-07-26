"use strict";

import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class OfflineTest extends PubnubTester {

	private _didConnect: boolean = false;

	describe () {
		return "when network connection goes offline, an Offline event should be omitted";
	}

	run (): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (event.status === PubnubStatus.Connected && !this._didConnect) {
				this._didConnect = true;
				this._pubnubConnection!.setOnline(false);
			}
			else if (event.status === PubnubStatus.Offline && this._didConnect) {
				this._resolve();
			}
			else {
				this._reject("receiver status should be Offline, was " + event.status);
			}
		});
		const promise = super.run();
		this.subscribeToUserChannel();
		return promise;
	}

	async after () {
		if (this._statusListener) {
			this._statusListener.dispose();
		}
		super.after();
	}
}