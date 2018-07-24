"use strict";
import { CodeStreamAgent } from "../agent";
import { CodeStreamApi } from "../api/api";
import { DidReceiveMessagesNotification } from "../ipc/agent";
import {
	ChannelDescriptor,
	PubnubConnection,
	PubnubStatus,
	StatusChangeEvent
} from "./pubnubConnection";

export class PubnubReceiver {
	private readonly _pubnubConnection: PubnubConnection;

	constructor(
		private _agent: CodeStreamAgent,
		api: CodeStreamApi,
		pubnubKey: string,
		pubnubToken: string,
		accessToken: string,
		private readonly _userId: string,
		private readonly _teamId: string
	) {
		this._pubnubConnection = new PubnubConnection();
		this._pubnubConnection.initialize({
			api,
			accessToken,
			subscribeKey: pubnubKey,
			authKey: pubnubToken,
			userId: _userId,
			online: true
		});

		this._pubnubConnection.onDidStatusChange(this.onPubnubStatusChanged, this);
		this._pubnubConnection.onDidReceiveMessages(this.onPubnubMessagesReceived, this);
	}

	listen(streamIds?: string[]) {
		const channels: ChannelDescriptor[] = [
			{ name: `user-${this._userId}` },
			{ name: `team-${this._teamId}`, withPresence: true }
		];

		for (const streamId of streamIds || []) {
			channels.push({ name: `stream-${streamId}` });
		}

		this._pubnubConnection.subscribe(channels);
	}

	private onPubnubStatusChanged(e: StatusChangeEvent) {
		switch (e.status) {
			case PubnubStatus.Connected:
				// TODO: let the extension know we are connected?
				break;

			case PubnubStatus.Trouble:
				// TODO: let the extension know we have trouble?
				break;

			case PubnubStatus.Reset:
				// TODO: must fetch all data fetch from the server
				break;

			case PubnubStatus.Offline:
				// TODO: let the extension know we are offline?
				break;

			case PubnubStatus.SomeFailed:
				// TODO: let the extension know we have trouble?
				// the indicated channels have not been subscribed to, what do we do?
				break;

			case PubnubStatus.Failed:
				// TODO: catastrophic failure event, what do we do?
				break;
		}
	}

	private onPubnubMessagesReceived(messages: { [key: string]: any }[]) {
		this._agent.sendNotification(DidReceiveMessagesNotification.type, messages);
	}
}
