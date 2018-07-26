"use strict";

import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester } from "./pubnubTester";

export class ResetAfterTooLongTest extends PubnubTester {

	describe () {
		return "if reconnecting after being disconnected for too long, a Reset event should be emitted";
	}

	run (): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (event.status === PubnubStatus.Reset) {
				this._resolve();
			}
			else {
				this._reject("unexpected receiver status " + event.status);
			}
		});
		const promise = super.run();
		this._pubnubConnection!.setLastMessageReceivedAt(1);
 		this.subscribeToUserChannel();
		return promise;
	}
}
