"use strict";

import { expect } from "chai";
import { PubnubStatus, StatusChangeEvent } from "../../pubnub/pubnubConnection";
import { PubnubTester, PubnubTesterConfig } from "./pubnubTester";
import {
	PostData,
	StreamData
} from "./types";

export class MultiMessageCatchUpTest extends PubnubTester {

	private _didSubscribe: boolean = false;
	private _didConnect: boolean = false;
	private _didGoOnline: boolean = false;
	protected _otherStreams: StreamData[] = [];
	protected _numStreams = 0;
	protected _numPostsPerStream = 0;
	protected _posts: PostData[] = [];
	private _firstStreamId: string | undefined;
	private _firstPostId: string | undefined;

	constructor (config: PubnubTesterConfig) {
		super(config);
		this._numStreams = 5;
		this._numPostsPerStream = 5;
		this._testTimeout = this._numStreams * this._numPostsPerStream * 500 + 10000;
	}

	describe () {
		return "multiple messages across several streams, missed while offline, should be received after going online";
	}

	async before () {
		await super.before();
		await this.createTeamAndStream();
		await this.createMoreStreams();
	}

	async createMoreStreams () {
		this._firstStreamId = this._streamData!._id;
		for (let i = 0; i < this._numStreams; i++) {
			await this.createChannel();
			this._otherStreams.push(this._streamData!);
		}
	}

	run (): Promise<void> {
		this._statusListener = this._pubnubConnection!.onDidStatusChange((event: StatusChangeEvent) => {
			if (
				event.status === PubnubStatus.Connected &&
				this._didSubscribe &&
				!this._didGoOnline
			) {
				this._didConnect = true;
				// create a first post, this sets the last message received to something, which
				// will cause the catch-up after the second comes in while offline
				this.createPost({ token: this._otherUserData!.accessToken });
			}
			else if (
				event.status === PubnubStatus.Connected &&
				this._didGoOnline
			) {
			}
			else if (
				event.status === PubnubStatus.Offline &&
				this._didConnect
			) {
			}
			else if (
				event.status === PubnubStatus.Confirmed &&
				this._didGoOnline
			) {
			}
/*
			else {
				this._reject("unexpected connection status: " + event.status);
			}
*/
		});
		const promise = super.run();
		this.listenForMessage();
		this._pubnubConnection!.subscribe([
			`stream-${this._firstStreamId!}`,
			...this._otherStreams.map(stream => `stream-${stream._id}`)
		]);
		this._didSubscribe = true;
		return promise;
	}

	listenForMessage () {
		this._messageListener = this._pubnubConnection!.onDidReceiveMessages(async (messages: any[]) => {
			if (
				messages.length === 1 &&
				messages[0].post &&
				messages[0].post._id === this._postData!._id &&
				!this._didGoOnline
			) {
				this._firstPostId = this._postData!._id;
				this._pubnubConnection!.simulateOffline();
				this._pubnubConnection!.setOnline(false);
				await this.createSeveralPosts();
				setTimeout(() => {
					this._didGoOnline = true;
					this._pubnubConnection!.simulateOffline(false);
					this._pubnubConnection!.setOnline(true);
				}, 2000);
			}
			else if (this._didGoOnline) {
				const postIdsReceived = messages.map(message => message.post._id);
				const postIdsCreated = [this._firstPostId, ...this._posts.map(post => post._id)];
				expect(postIdsReceived).to.deep.equal(postIdsCreated);
				this._resolve();
			}
		});
	}

	async createSeveralPosts () {
		for (let i = 0; i < this._numPostsPerStream; i++) {
			for (let j = 0; j < this._numStreams; j++) {
				await this.createPost({
					data: {
						streamId: this._otherStreams[j]._id,
						text: (i * 5 + j + 1).toString()
					},
					token: this._otherUserData!.accessToken
				});
				await this.pause(500);
				this._posts.push(this._postData!);
			}
		}
	}

	async pause (n: number) {
		return new Promise(resolve => {
			setTimeout(resolve, n);
		});
	}
}
