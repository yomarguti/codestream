"use strict";
import { RequestType } from "vscode-languageserver-protocol";
import {
	ChannelServiceType,
	CSChannelStream,
	CSDirectStream,
	CSFileStream,
	CSPush,
	CSStream,
	StreamType
} from "./api.protocol";

export interface CreateChannelStreamRequest {
	type: StreamType.Channel;
	name: string;
	memberIds: string[] | undefined;
	isTeamStream: boolean;
	privacy: "public" | "private";
	purpose?: string;
	serviceType?: ChannelServiceType.Vsls;
	serviceKey?: string;
	serviceInfo?: { [key: string]: any };
}

export interface CreateChannelStreamResponse {
	stream: CSChannelStream;
}

export const CreateChannelStreamRequestType = new RequestType<
	CreateChannelStreamRequest,
	CreateChannelStreamResponse,
	void,
	void
>("codeStream/streams/createChannel");

export interface CreateDirectStreamRequest {
	type: StreamType.Direct;
	memberIds: string[];
}

export interface CreateDirectStreamResponse {
	stream: CSDirectStream;
}

export const CreateDirectStreamRequestType = new RequestType<
	CreateDirectStreamRequest,
	CreateDirectStreamResponse,
	void,
	void
>("codeStream/streams/createDirect");

export interface FetchStreamsRequest {
	types?: (StreamType.Channel | StreamType.Direct)[];
	streamIds?: string[];
}

export interface FetchStreamsResponse {
	streams: (CSChannelStream | CSDirectStream)[];
}

export const FetchStreamsRequestType = new RequestType<
	FetchStreamsRequest,
	FetchStreamsResponse,
	void,
	void
>("codeStream/streams");

export interface FetchFileStreamsRequest {
	repoId: string;
}

export interface FetchFileStreamsResponse {
	streams: CSFileStream[];
}

export const FetchFileStreamsRequestType = new RequestType<
	FetchFileStreamsRequest,
	FetchFileStreamsResponse,
	void,
	void
>("codeStream/streams/file");

export interface FetchUnreadStreamsRequest {}

export interface FetchUnreadStreamsResponse {
	streams: CSStream[];
}

export const FetchUnreadStreamsRequestType = new RequestType<
	FetchUnreadStreamsRequest,
	FetchUnreadStreamsResponse,
	void,
	void
>("codeStream/streams/unread");

export interface GetStreamRequest {
	streamId: string;
}

export interface GetStreamResponse {
	stream: CSStream;
}

export const GetStreamRequestType = new RequestType<
	GetStreamRequest,
	GetStreamResponse,
	void,
	void
>("codeStream/stream");

export interface JoinStreamRequest {
	streamId: string;
}

export interface JoinStreamResponse {
	stream: CSStream;
}

export const JoinStreamRequestType = new RequestType<
	JoinStreamRequest,
	JoinStreamResponse,
	void,
	void
>("codeStream/stream/join");

export interface LeaveStreamRequest {
	streamId: string;
}

export interface LeaveStreamResponse {
	stream: CSStream;
}

export const LeaveStreamRequestType = new RequestType<
	LeaveStreamRequest,
	LeaveStreamResponse,
	void,
	void
>("codeStream/stream/leave");

export interface MarkStreamReadRequest {
	streamId: string;
	postId?: string;
}

export interface MarkStreamReadResponse {}

export const MarkStreamReadRequestType = new RequestType<
	MarkStreamReadRequest,
	MarkStreamReadResponse,
	void,
	void
>("codeStream/stream/markRead");

export interface UpdateStreamRequest {
	streamId: string;
	changes: { [key: string]: any };
}

export interface UpdateStreamResponse {
	stream: CSStream;
}

export const UpdateStreamRequestType = new RequestType<
	UpdateStreamRequest,
	UpdateStreamResponse,
	void,
	void
>("codeStream/stream/update");

export interface UpdateStreamMembershipRequest {
	streamId: string;
	// TODO: Fix this
	push: CSPush;
}

export interface UpdateStreamMembershipResponse {
	stream: CSStream;
}

export const UpdateStreamMembershipRequestType = new RequestType<
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse,
	void,
	void
>("codeStream/stream/updateMembership");
