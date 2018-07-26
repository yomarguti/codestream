"use strict";

import { MultiMessageCatchUpTest } from "./multiMessageCatchUpTest";
import { PubnubTesterConfig } from "./pubnubTester";

export class ExceedBatchLimitTest extends MultiMessageCatchUpTest {

	private _whichStream: number;
	private _numExtraPostsPerPost: number;

	constructor (config: PubnubTesterConfig) {
		super(config);
		this._whichStream = 2;
		this._numExtraPostsPerPost = 40;
		this._testTimeout = (
			this._numStreams * this._numPostsPerStream +
			this._numPostsPerStream * this._numExtraPostsPerPost
		) * 500 + 30000;
	}

	describe () {
		return "multiple messages across several streams, including more than 25 messages in a stream, missed while offline, should be received after going online";
	}

	async createSeveralPosts () {
		let postNum = 0;
		for (let i = 0; i < this._numPostsPerStream; i++) {
			for (let j = 0; j < this._numStreams; j++) {
				let numPosts = 1;
				if (j === this._whichStream) {
					numPosts += this._numExtraPostsPerPost;
				}
				for (let k = 0; k < numPosts; k++) {
					postNum++;
					await this.createPost({
						data: {
							streamId: this._otherStreams[j]._id,
							text: postNum.toString()
						},
						token: this._otherUserData!.accessToken
					});
					await this.pause(500);
					this._posts.push(this._postData!);
				}
			}
		}
	}
}
