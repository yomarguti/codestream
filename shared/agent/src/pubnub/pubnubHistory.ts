// Retrieves recent history of messages from Pubnub, in case of disconnect or gaps in the session

"use strict";
import * as Pubnub from "pubnub";

export interface PubnubHistoryInput {
	pubnub: Pubnub;
	channels: string[];
	since: number;
	debug?(msg: string, info?: any): void; // for debug messages
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
	private _debug: (msg: string, info?: any) => void = () => {};

	// Fetch the history of messages that have come through the specified channels since the specified timestamp
	// We do a batch fetch (https://www.pubnub.com/docs/nodejs-javascript/api-reference-storage-and-playback#batch-history)
	// across all channels, though if there are more than 500 channels (will there ever be?), we split that into slices.
	// However, no more than 25 messages will be fetched per channel, so if we see 25 messages for one or more
	// channels, we'll fetch individually from each of those channels using Pubnub's history function
	//
	// To avoid excessive processing of messages, we have two limits: one, if the time since last retrieval is over a
	// week, we return a "Reset" indicator, indicating that rather than trying to fetch history, the client should
	// simply start their session from scratch ... this covers "vacation" and other long-disconnected scenarios ...
	// Note that this constraint is also a function of Pubnub, which is set to save messages only up to a week old
	//
	// The other Reset condition is if we end up with too many messages coming across the wire, current that limit is
	// set to 1000 messages for a channel
	//
	async fetchHistory(options: PubnubHistoryInput): Promise<PubnubHistoryOutput> {
		this._pubnub = options.pubnub;
		this._channels = options.channels;
		this._since = options.since;
		if (options.debug) {
			this._debug = options.debug;
		}

		const output: PubnubHistoryOutput = {};

		// split into slices of 500 channels, which we may never reach, but it's here if we do
		let startSlice = 0;
		let done = false;
		let channels = [];
		const sliceSize = 500; // batch history is limited to 500 channels
		do {
			channels = this._channels.slice(startSlice, sliceSize);
			if (channels.length > 0 && (await this.fetchByChannelSlice(output, channels))) {
				this.processMessages(output);
				startSlice += sliceSize;
			} else {
				done = true;
			}
		} while (!done && channels.length > 0);
		if (!output.reset) {
			output.messages = this._allMessages.map(message => message.message || message.entry);
		}
		return output;
	}

	// fetch historical messages for a slice of 500 channels
	private async fetchByChannelSlice(
		output: PubnubHistoryOutput,
		channels: string[]
	): Promise<boolean> {
		const timetoken = this.timestampToTimetokenStringified(this._since);
		try {
			await this.retrieveBatchHistory(channels, timetoken);
		} catch (error) {
			// if we reached a "RESET" condition, break out and inform the client, we'll proceed no further
			if (error === "RESET") {
				output.reset = true;
				return false;
			} else {
				throw error;
			}
		}
		return true;
	}

	// process the messages we received ... since the messages are coming from multiple channels, we sort
	// them by timestamp before returning to the client, giving the client a true chronological "replay"
	private processMessages(output: PubnubHistoryOutput) {
		this._allMessages.forEach(message => {
			message.timestamp = parseInt(message.timetoken, 10);
		});
		this._allMessages.sort((a, b) => {
			return a.timestamp - b.timestamp;
		});

		if (this._allMessages.length > 0) {
			// store the last message received, so we know where to start from next time
			output.timestamp = this.timetokenToTimeStamp(
				this._allMessages[this._allMessages.length - 1].timestamp
			);
		}
	}

	// retrieve historical messages in batch
	private async retrieveBatchHistory(channels: string[], timetoken: string) {
		this._debug(`Calling Pubnub.fetchMessages from ${timetoken} for ${channels.join(",")}`);
		const response: any = await (this._pubnub! as any).fetchMessages({
			channels,
			end: timetoken,
			count: 25,
			stringifiedTimeToken: true
		});
		this._debug("fetchMessages response", response);
		/*
		const response: Pubnub.FetchMessagesResponse = await this._pubnub!.fetchMessages({
			channels,
			end: timetoken,
			stringifiedTimeToken: true
		} as Pubnub.FetchMessagesParameters);
*/

		// look for any channels that have 25 messages ... for these, we assume there are more
		// messages waiting, and we fetch individually for each channel, where we can get
		// more messages at a time
		const channelsWithMoreMessages: string[] = [];
		const earliestTimetokenPerChannel: { [key: string]: number } = {};
		for (const channel in response.channels) {
			const messages = response.channels[channel];
			this._allMessages.push(...messages);
			if (messages.length === 25) {
				channelsWithMoreMessages.push(channel);
			}
			for (const message of messages) {
				const timetoken = parseInt(message.timetoken, 10);
				if (
					!earliestTimetokenPerChannel[channel] ||
					timetoken < earliestTimetokenPerChannel[channel]
				) {
					earliestTimetokenPerChannel[channel] = timetoken;
				}
			}
		}

		await Promise.all(
			channelsWithMoreMessages.map(async channel => {
				await this.retrieveChannelHistory(channel, earliestTimetokenPerChannel[channel] - 1);
			})
		);
	}

	// retrieve the historical messages for an individual channel ... we can only retrieve in
	// pages of 100 ... but if we get to the limit of 1000 messages (10 pages), we'll stop
	// and force the client to do a session reset instead
	private async retrieveChannelHistory(channel: string, before: number, depth: number = 0) {
		if (depth === 10) {
			throw new Error("RESET");
		}
		this._debug(`Calling Pubnub.history from ${before} for ${channel}`);
		const response: any = await (this._pubnub! as any).history({
			channel,
			start: before.toString(),
			stringifiedTimeToken: true
		});
		this._debug("history response", response);

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

	// convert from unix timestamp to stringified Pubnub time token
	private timestampToTimetokenStringified(timestamp: number): string {
		return (timestamp * 10000).toString();
	}

	// convert from Pubnub time token to unix timestamp
	private timetokenToTimeStamp(timetoken: string): number {
		return Math.floor(parseInt(timetoken, 10) / 10000);
	}
}
