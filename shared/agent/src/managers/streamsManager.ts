"use strict";
import { CodeStreamApiProvider } from "../api/codestream/codestreamApi";
import { Container } from "../container";
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
	SetStreamPurposeResponse,
	SetStreamPurposeRequest,
	SetStreamPurposeRequestType,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipRequestType,
	UpdateStreamMembershipResponse,
	UpdateStreamRequest,
	UpdateStreamRequestType,
	UpdateStreamResponse
} from "../shared/agent.protocol";
import { CSChannelStream, CSDirectStream, CSStream, StreamType } from "../shared/api.protocol";
import { lspHandler } from "../system";
import { KeyValue } from "./cache/baseCache";
import { CachedEntityManagerBase, Id } from "./entityManager";

export class StreamsManager extends CachedEntityManagerBase<CSChannelStream | CSDirectStream> {
	@lspHandler(FetchStreamsRequestType)
	async get(request?: FetchStreamsRequest): Promise<FetchStreamsResponse> {
		let streams = await this.ensureCached();
		if (request != null) {
			if (request.streamIds != null && request.streamIds.length !== 0) {
				streams = streams.filter(s => request.streamIds!.includes(s.id));
			}

			if (request.types != null && request.types.length !== 0) {
				streams = streams.filter(s => request.types!.includes(s.type));
			}
		}

		return { streams: streams };
	}

	protected async loadCache() {
		const response = await this.session.api.fetchStreams({});
		this.cache.set(response.streams);
	}

	async getSubscribable() {
		const response = await this.get({ types: [StreamType.Channel, StreamType.Direct] });
		return {
			streams: response.streams.filter(s =>
				CodeStreamApiProvider.isStreamSubscriptionRequired(s, this.session.userId)
			)
		};
	}

	@lspHandler(FetchUnreadStreamsRequestType)
	getUnread(request?: FetchUnreadStreamsRequest): Promise<FetchUnreadStreamsResponse> {
		return this.session.api.fetchUnreadStreams(request || {});
	}

	protected async fetchById(id: Id): Promise<CSChannelStream | CSDirectStream> {
		try {
			const response = await this.session.api.getStream({ streamId: id });
			return response.stream as CSChannelStream | CSDirectStream;
		} catch (err) {
			Logger.error(err);
			// When the user doesn't have access to the stream, the server returns a 403. If
			// this error occurs, it could be that we're subscribed to streams we're not
			// supposed to be subscribed to.
			Logger.warn(`Error fetching stream id=${id}`);
			return undefined!;
		}
	}

	async cacheGet(
		criteria: KeyValue<CSStream>[]
	): Promise<CSChannelStream | CSDirectStream | undefined> {
		const cached = await super.cacheGet(criteria);
		if (cached) {
			return cached;
		} else {
			return (await Container.instance().files.cacheGet(criteria)) as any;
		}
	}

	cacheSet(entity: CSStream, oldEntity?: CSStream) {
		switch (entity.type) {
			case StreamType.Channel:
			case StreamType.Direct:
				return super.cacheSet(entity, oldEntity as any);
			case StreamType.File:
				return Container.instance().files.cacheSet(entity, oldEntity as any);
		}
	}

	@lspHandler(CreateChannelStreamRequestType)
	createChannelStream(request: CreateChannelStreamRequest): Promise<CreateChannelStreamResponse> {
		return this.session.api.createChannelStream(request);
	}

	@lspHandler(CreateDirectStreamRequestType)
	createDirectStream(request: CreateDirectStreamRequest): Promise<CreateDirectStreamResponse> {
		return this.session.api.createDirectStream(request);
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

	@lspHandler(SetStreamPurposeRequestType)
	setStreamPurpose(request: SetStreamPurposeRequest): Promise<SetStreamPurposeResponse> {
		return this.session.api.setStreamPurpose(request);
	}

	@lspHandler(GetStreamRequestType)
	private async getStream(request: GetStreamRequest): Promise<GetStreamResponse> {
		const stream = await this.getById(request.streamId);
		return { stream: stream };
	}
}
