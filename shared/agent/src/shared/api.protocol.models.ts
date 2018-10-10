"use strict";

export interface CSEntity {
	deactivated?: boolean;
	createdAt: number;
	modifiedAt: number;
	id: string;
	creatorId: string;
}

export interface CSMarkerCodeBlock {
	code: string;
	commitHash: string;
	location: CSLocationArray;
	file: string;
	repoId: string;
	streamId: string;
}

export interface CSMarker extends CSEntity {
	teamId: string;
	streamId: string;
	postId: string;
	postStreamId: string;
	commitHashWhenCreated: string;
	codeBlock?: CSMarkerCodeBlock;
}

export interface CSLocationMeta {
	startWasDeleted?: boolean;
	endWasDeleted?: boolean;
	entirelyDeleted?: boolean;
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
	repoId?: string;
	seqNum: number;
	text: string;
	codeBlocks?: CSCodeBlock[];
	commitHashWhenPosted?: string;
	hasBeenEdited: boolean;
	hasReplies: boolean;
	mentionedUserIds?: string[];
	origin?: "email" | "slack" | "teams";
	parentPostId?: string;
	reactions?: { [key: string]: boolean };
	files?: [
		{
			name: string;
			url: string;
			type: string;
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
}

export interface CSDirectStream extends CSEntity {
	isArchived: boolean;
	privacy: "public" | "private";
	sortId: string;
	teamId: string;
	mostRecentPostCreatedAt?: number;
	mostRecentPostId?: string;
	purpose?: string;

	type: StreamType.Direct;
	name?: string;
	memberIds: string[];
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
}

export interface CSMeLastReads {
	[streamId: string]: number;
}

export interface CSMePreferences {
	[key: string]: any;
}

export interface CSMe extends CSUser {
	lastReads: CSMeLastReads;
	preferences: CSMePreferences;
	providerInfo?: {
		slack?: CSSlackProviderInfo;
	};
}
