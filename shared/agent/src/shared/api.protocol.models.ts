"use strict";

export interface CSEntity {
	deactivated?: boolean;
	createdAt: number;
	modifiedAt: number;
	id: string;
	creatorId: string;
	version?: number;
}

export enum ProviderType {
	Slack = "slack"
}

export enum CodemarkType {
	Comment = "comment",
	Question = "question",
	Trap = "trap"
}

export interface CSCodemark extends CSEntity {
	teamId: string;
	streamId: string;
	postId: string;
	parentPostId?: string;
	markerIds?: string[];
	fileStreamIds: string[];
	providerType?: ProviderType;
	type: CodemarkType;
	color: string;
	status: string;
	title: string;
	assignees: string[];
	text: string;
	numReplies: number;
}

export interface CSMarker extends CSEntity {
	teamId: string;
	fileStreamId: string;
	postStreamId: string;
	postId: string;
	codemarkId: string;
	providerType?: ProviderType;
	commitHashWhenCreated: string;
	locationWhenCreated: CSLocationArray;
	code: string;
	file: string;
	repo: string;
	repoId: string;
}

export interface CSLocationMeta {
	startWasDeleted?: boolean;
	endWasDeleted?: boolean;
	entirelyDeleted?: boolean;
	contentChanged?: boolean;
}

export type CSLocationArray = [number, number, number, number, CSLocationMeta | undefined];

export interface CSMarkerLocations {
	teamId: string;
	streamId: string;
	commitHash: string;
	locations: { [id: string]: CSLocationArray };
}

export interface CSMarkerLocation {
	id: string;
	lineStart: number;
	colStart: number;
	lineEnd: number;
	colEnd: number;
	meta?: CSLocationMeta;
}

export interface CSCodeBlock {
	code: string;
	markerId: string;
	file: string;
	repoId: string;
	streamId?: string;
}

export interface CSPost extends CSEntity {
	teamId: string;
	streamId: string;
	parentPostId?: string;
	numReplies: number;
	text: string;
	seqNum: number | string;
	hasBeenEdited: boolean;
	mentionedUserIds?: string[];
	origin?: "email" | "slack" | "teams";
	reactions?: { [key: string]: boolean };
	codemarkId?: string;
	files?: [
		{
			mimetype: string;
			name: string;
			title: string;
			type: string;
			url: string;
			preview?:
				| string
				| {
						url: string;
						width: number;
						height: number;
				  };
		}
	];
}

export interface CSRemote {
	url: string;
	normalizedUrl: string;
	companyIdentifier: string;
}

export interface CSRepository extends CSEntity {
	name: string;
	remotes: CSRemote[];
	teamId: string;
}

export enum StreamType {
	Channel = "channel",
	Direct = "direct",
	File = "file"
}

export enum ChannelServiceType {
	Vsls = "vsls"
}

export interface CSChannelStream extends CSEntity {
	isArchived: boolean;
	privacy: "public" | "private";
	sortId: string;
	teamId: string;
	mostRecentPostCreatedAt?: number;
	mostRecentPostId?: string;
	purpose?: string;

	type: StreamType.Channel;
	name: string;
	memberIds?: string[];
	isTeamStream: boolean;
	serviceType?: ChannelServiceType.Vsls;
	serviceKey?: string;
	serviceInfo?: { [key: string]: any };

	priority?: number;
}

export interface CSDirectStream extends CSEntity {
	isArchived: boolean;
	isClosed?: boolean;
	privacy: "public" | "private";
	sortId: string;
	teamId: string;
	mostRecentPostCreatedAt?: number;
	mostRecentPostId?: string;
	purpose?: string;

	type: StreamType.Direct;
	name?: string;
	memberIds: string[];

	priority?: number;
}

export interface CSFileStream extends CSEntity {
	isArchived: boolean;
	privacy: "public" | "private";
	sortId: string;
	teamId: string;
	mostRecentPostCreatedAt?: number;
	mostRecentPostId?: string;
	purpose?: string;

	type: StreamType.File;
	file: string;
	repoId: string;
	numMarkers: number;
	editingUsers?: any;
}

export type CSStream = CSChannelStream | CSDirectStream | CSFileStream;

export interface CSTeamSlackProviderInfo {
	teamId: string;
}

export interface CSCompany extends CSEntity {
	name: string;
}

export interface CSTeam extends CSEntity {
	companyId: string;
	memberIds: string[];
	name: string;
	primaryReferral: "internal" | "external";
	integrations?: { [key: string]: { enabled: boolean } };
	providerInfo?: {
		slack?: CSTeamSlackProviderInfo;
	};
}

export interface CSSlackProviderInfo {
	accessToken: string;
	teamId: string;
	userId: string;
}

export interface CSUser extends CSEntity {
	companyIds: string[];
	email: string;
	firstName: string;
	fullName: string;
	isRegistered: boolean;
	iWorkOn?: string;
	lastName: string;
	lastPostCreatedAt: number;
	numMentions: number;
	numInvites: number;
	registeredAt: number;
	secondaryEmails?: string[];
	teamIds: string[];
	timeZone: string;
	totalPosts: number;
	username: string;

	avatar?: {
		image?: string;
		image48?: string;
	};
	dnd?: boolean;
	presence?: string;
	preferences?: CSMePreferences;
}

export interface CSLastReads {
	[streamId: string]: number | string;
}

export interface CSMePreferences {
	[key: string]: any;
}

export interface CSMe extends CSUser {
	lastReads: CSLastReads;
	joinMethod: string;
	preferences: CSMePreferences;
	providerInfo?: {
		slack?: CSSlackProviderInfo;
	};
}
