"use strict";
import { Logger } from "../logger";
import {
	CreateChannelStreamRequest,
	CreateChannelStreamRequestType,
	CreateChannelStreamResponse,
	CreateDirectStreamRequest,
	CreateDirectStreamRequestType,
	CreateDirectStreamResponse,
	FetchStreamsRequest,
	FetchStreamsRequestType,
	FetchStreamsResponse,
	FetchUnreadStreamsRequest,
	FetchUnreadStreamsRequestType,
	FetchUnreadStreamsResponse,
	GetStreamRequest,
	GetStreamRequestType,
	GetStreamResponse,
	JoinStreamRequest,
	JoinStreamRequestType,
	JoinStreamResponse,
	LeaveStreamRequest,
	LeaveStreamRequestType,
	LeaveStreamResponse,
	MarkStreamReadRequest,
	MarkStreamReadRequestType,
	MarkStreamReadResponse,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipRequestType,
	UpdateStreamMembershipResponse,
	UpdateStreamRequest,
	UpdateStreamRequestType,
	UpdateStreamResponse
} from "../shared/agent.protocol";
import { CSChannelStream, CSDirectStream } from "../shared/api.protocol";
import { lspHandler } from "../system";
import { EntityManager, Id } from "./managers";

export class StreamsManager extends EntityManager<CSChannelStream | CSDirectStream> {
	private loaded = false;

	// protected init() {
	// 	this.session.onStreamsChanged(this.onStreamsChanged, this);
	// }

	// protected onStreamsChanged(streams: CSStream[]) {
	// 	// const { pubnub, userId } = this.session;
	// 	// TODO Eric help!!!
	// 	// pubnub.subscribe([
	// 	// 	...Iterables.filterMap(
	// 	// 		streams,
	// 	// 		s => (CodeStreamApi.isStreamSubscriptionRequired(s, userId) ? `stream-${s.id}` : undefined)
	// 	// 	)
	// 	// ]);
	// }

	@lspHandler(CreateChannelStreamRequestType)
	createChannelStream(request: CreateChannelStreamRequest): Promise<CreateChannelStreamResponse> {
		return this.session.api.createChannelStream(request);
	}

	@lspHandler(CreateDirectStreamRequestType)
	createDirectStream(request: CreateDirectStreamRequest): Promise<CreateDirectStreamResponse> {
		return this.session.api.createDirectStream(request);
	}

	async getAll(): Promise<(CSChannelStream | CSDirectStream)[]> {
		if (!this.loaded) {
			const response = await this.session.api.fetchStreams({});
			for (const stream of response.streams) {
				this.cache.set(stream);
			}
			this.loaded = true;
		}

		return this.cache.getAll();
	}

	@lspHandler(JoinStreamRequestType)
	joinStream(request: JoinStreamRequest): Promise<JoinStreamResponse> {
		return this.session.api.joinStream(request);
	}

	@lspHandler(LeaveStreamRequestType)
	leaveStream(request: LeaveStreamRequest): Promise<LeaveStreamResponse> {
		return this.session.api.leaveStream(request);
	}

	@lspHandler(MarkStreamReadRequestType)
	markStreamRead(request: MarkStreamReadRequest): Promise<MarkStreamReadResponse> {
		return this.session.api.markStreamRead(request);
	}

	@lspHandler(UpdateStreamRequestType)
	updateStream(request: UpdateStreamRequest): Promise<UpdateStreamResponse> {
		return this.session.api.updateStream(request);
	}

	@lspHandler(UpdateStreamMembershipRequestType)
	updateStreamMembership(
		request: UpdateStreamMembershipRequest
	): Promise<UpdateStreamMembershipResponse> {
		return this.session.api.updateStreamMembership(request);
	}
	protected async fetch(id: Id): Promise<CSChannelStream | CSDirectStream> {
		try {
			const response = await this.session.api.getStream({ streamId: id });
			return response.stream as CSChannelStream | CSDirectStream;
		} catch (err) {
			// When the user doesn't have access to the stream, the server returns a 403. If
			// this error occurs, it could be that we're subscribed to streams we're not
			// supposed to be subscribed to.
			Logger.warn(`Error fetching stream id=${id}`);
			return undefined!;
		}
	}

	@lspHandler(GetStreamRequestType)
	private async getStream(request: GetStreamRequest): Promise<GetStreamResponse> {
		const stream = await this.getById(request.streamId);
		return { stream: stream };
	}

	@lspHandler(FetchStreamsRequestType)
	private async fetchStreams(request: FetchStreamsRequest): Promise<FetchStreamsResponse> {
		const streams = await this.getAll();
		if (request.streamIds == null || request.streamIds.length === 0) {
			return { streams: streams };
		}

		return { streams: streams.filter(s => request.streamIds!.includes(s.id)) };
	}

	@lspHandler(FetchUnreadStreamsRequestType)
	private async fetchUnreadStreams(
		request: FetchUnreadStreamsRequest
	): Promise<FetchUnreadStreamsResponse> {
		return this.session.api.fetchUnreadStreams({});
	}
}
