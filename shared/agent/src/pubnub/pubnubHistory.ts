"use strict";
import * as Pubnub from "pubnub";

export interface PubnubHistoryInput {
	pubnub: Pubnub;
	channels: string[];
	since: number;
}

export interface PubnubHistoryOutput {
	timestamp?: number;
	messages?: object[];
	reset?: boolean;
}

export class PubnubHistory {
	private _pubnub: Pubnub | undefined;
	private _channels: string[] = [];
	private _since: number = 0;
	private _allMessages: any[] = [];

	async fetchHistory(options: PubnubHistoryInput): Promise<PubnubHistoryOutput> {
		this._pubnub = options.pubnub;
		this._channels = options.channels;
		this._since = options.since;

		const output: PubnubHistoryOutput = {};

		let startSlice = 0;
		let done = false;
		let channels = [];
		const sliceSize = 500; // https://www.pubnub.com/docs/nodejs-javascript/api-reference-storage-and-playback#batch-history
		do {
			channels = this._channels.slice(startSlice, sliceSize);
			if (await this.fetchByChannelSlice(output, channels)) {
				this.processMessages(output);
				startSlice += sliceSize;
			} else {
				done = true;
			}
		} while (!done && channels.length > 0);
		return output;
	}

	private async fetchByChannelSlice(
		output: PubnubHistoryOutput,
		channels: string[]
	): Promise<boolean> {
		const timetoken = this.timestampToTimetokenStringified(this._since);
		try {
			await this.retrieveBatchHistory(channels, timetoken);
		} catch (error) {
			if (error === "RESET") {
				output.reset = true;
				return false;
			} else {
				throw error;
			}
		}
		return true;
	}

	private processMessages(output: PubnubHistoryOutput): object[] {
		this._allMessages.forEach(message => {
			message.timestamp = this.timetokenToTimestamp(message.timetoken);
		});
		this._allMessages.sort((a, b) => {
			return a.timestamp - b.timestamp;
		});

		if (this._allMessages.length > 0) {
			// store the last message received, so we know where to start from next time
			output.timestamp = this._allMessages[this._allMessages.length - 1].timestamp;
		}
		return this._allMessages.map(message => message.entry);
	}

	private async retrieveBatchHistory(channels: string[], timetoken: string, depth: number = 0) {
		if (depth === 100) {
			throw new Error("RESET");
		}
		const response: any = await (this._pubnub! as any).fetchMessages({
			channels,
			end: timetoken,
			stringifiedTimeToken: true
		});
		/*
		const response: Pubnub.FetchMessagesResponse = await this._pubnub!.fetchMessages({
			channels,
			end: timetoken,
			stringifiedTimeToken: true
		} as Pubnub.FetchMessagesParameters);
*/

		const channelsWithMoreMessages: string[] = [];
		const latestTimetokenPerChannel: { [key: string]: number } = {};
		for (const channel in response) {
			this._allMessages.push(...response.channels[channel]);
			if (response.channels[channel].length === 25) {
				channelsWithMoreMessages.push(channel);
			}
			for (const message of response.channels[channel]) {
				const timetoken = parseInt(message.timetoken, 10);
				if (!latestTimetokenPerChannel[channel] || timetoken > latestTimetokenPerChannel[channel]) {
					latestTimetokenPerChannel[channel] = timetoken;
				}
			}
		}

		await Promise.all(
			channelsWithMoreMessages.map(async channel => {
				await this.retrieveChannelHistory(channel, latestTimetokenPerChannel[channel]);
			})
		);
	}

	private async retrieveChannelHistory(channel: string, since: number, depth: number = 0) {
		if (depth === 100) {
			throw new Error("RESET");
		}
		const response: any = await (this._pubnub! as any).history({
			channel,
			end: since.toString(),
			stringifiedTimeToken: true
		});
		/*
		const response: Pubnub.HistoryResponse = await this._pubnub!.history({
			channel,
			end: since.toString(),
			stringifiedTimeToken: true
		} as Pubnub.HistoryParameters);
*/

		this._allMessages.push(...response.messages);
		if (response.messages.length >= 100) {
			await this.retrieveChannelHistory(channel, parseInt(response.startTimeToken!, 10), depth + 1);
		}
	}

	private timetokenToTimestamp(timetoken: string): number {
		return parseInt(timetoken, 10) / 10000;
	}

	private timestampToTimetokenStringified(timestamp: number): string {
		return (timestamp * 10000).toString();
	}
}
