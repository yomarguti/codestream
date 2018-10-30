"use strict";
import { RequestType } from "vscode-languageserver-protocol";
import {
	ChannelServiceType,
	CSChannelStream,
	CSDirectStream,
	CSFileStream,
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

export interface ArchiveStreamRequest {
	streamId: string;
}

export interface ArchiveStreamResponse {
	stream: CSChannelStream;
}

export const ArchiveStreamRequestType = new RequestType<
	ArchiveStreamRequest,
	ArchiveStreamResponse,
	void,
	void
>("codeStream/stream/archive");

export interface CloseStreamRequest {
	streamId: string;
}

export interface CloseStreamResponse {
	stream: CSDirectStream;
}

export const CloseStreamRequestType = new RequestType<
	CloseStreamRequest,
	CloseStreamResponse,
	void,
	void
>("codeStream/stream/close");

export interface GetStreamRequest {
	streamId: string;
	type?: StreamType;
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
	stream: CSChannelStream;
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
	stream: CSChannelStream;
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

export interface MuteStreamRequest {
	streamId: string;
	mute: boolean;
}

export interface MuteStreamResponse {
	stream: CSChannelStream | CSDirectStream;
}

export const MuteStreamRequestType = new RequestType<
	MuteStreamRequest,
	MuteStreamResponse,
	void,
	void
>("codeStream/stream/mute");

export interface RenameStreamRequest {
	streamId: string;
	name: string;
}

export interface RenameStreamResponse {
	stream: CSChannelStream;
}

export const RenameStreamRequestType = new RequestType<
	RenameStreamRequest,
	RenameStreamResponse,
	void,
	void
>("codeStream/stream/rename");

export interface SetStreamPurposeRequest {
	streamId: string;
	purpose: string;
}

export interface SetStreamPurposeResponse {
	stream: CSChannelStream | CSDirectStream;
}

export const SetStreamPurposeRequestType = new RequestType<
	SetStreamPurposeRequest,
	SetStreamPurposeResponse,
	void,
	void
>("codeStream/stream/setPurpose");

export interface UnarchiveStreamRequest {
	streamId: string;
}

export interface UnarchiveStreamResponse {
	stream: CSChannelStream;
}

export const UnarchiveStreamRequestType = new RequestType<
	UnarchiveStreamRequest,
	UnarchiveStreamResponse,
	void,
	void
>("codeStream/stream/unarchive");

export interface UpdateStreamMembershipRequest {
	streamId: string;
	add?: string[];
	remove?: string[];
}

export interface UpdateStreamMembershipResponse {
	stream: CSChannelStream;
}

export const UpdateStreamMembershipRequestType = new RequestType<
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse,
	void,
	void
>("codeStream/stream/updateMembership");
