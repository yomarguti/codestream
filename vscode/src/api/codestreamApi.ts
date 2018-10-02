"use strict";
import { Uri } from "vscode";
import { Container } from "../container";
import { ChannelServiceType } from "../shared/api.protocol";
import {
	ApiMiddleware,
	CodeStreamApi,
	CSChannelStream,
	CSDirectStream,
	CSFileStream,
	CSMarker,
	CSMarkerLocations,
	CSPost,
	CSRepository,
	CSStream,
	CSTeam,
	CSUser,
	PresenceStatus,
	StreamType
} from "./api";
import { ApiProvider } from "./apiProvider";
import { Cache } from "./cache";

export class CodeStreamApiProvider implements ApiProvider {
	private readonly _codestream: CodeStreamApi;

	constructor(
		baseUrl: string,
		private readonly _token: string,
		private readonly _teamId: string,
		private _cache: Cache
	) {
		this._codestream = new CodeStreamApi(baseUrl);
	}

	get baseUrl() {
		return this._codestream.baseUrl;
	}
	set baseUrl(value: string) {
		this._codestream.baseUrl = value;
	}

	useMiddleware(middleware: ApiMiddleware) {
		return this._codestream.useMiddleware(middleware);
	}

	async savePreferences(preferences: {}) {
		await this._codestream.savePreferences(this._token, preferences);
		return this.getMe();
	}

	async getMe() {
		return (await this._codestream.getMe(this._token)).user;
	}

	// async addUserToStream(streamId: string, userId: string, teamId?: string) {
	// 	return (await this._api.updateStreamMembership(this.token, teamId || this.teamId, streamId, {
	// 		$push: userId
	// 	})).stream;
	// }

	async invite(email: string, teamId: string, fullName?: string): Promise<CSUser> {
		return (await this._codestream.invite(this._token, { email, teamId, fullName })).user;
	}

	async createPost(
		text: string,
		mentionedUserIds: string[],
		parentPostId: string | undefined,
		streamId: string,
		teamId?: string
	): Promise<CSPost | undefined> {
		return (await this._codestream.createPost(this._token, {
			mentionedUserIds,
			teamId: teamId || this._teamId,
			streamId: streamId,
			text: text,
			parentPostId
		})).post;
	}

	// async createRepo(
	// 	uri: Uri,
	// 	firstCommitHashes: string[],
	// 	teamId?: string
	// ): Promise<CSRepository | undefined> {
	// 	return (await this._api.createRepo(this.token, {
	// 		teamId: teamId || this.teamId,
	// 		url: uri.toString(),
	// 		knownCommitHashes: firstCommitHashes
	// 	})).repo;
	// }

	async createChannelStream(
		name: string,
		membership?: "auto" | string[],
		privacy: "public" | "private" = membership === "auto" ? "public" : "private",
		purpose?: string,
		service?: {
			serviceType: ChannelServiceType;
			serviceKey?: string;
			serviceInfo?: { [key: string]: any };
		},
		teamId?: string
	): Promise<CSChannelStream | undefined> {
		return (await this._codestream.createStream(this._token, {
			type: StreamType.Channel,
			teamId: teamId || this._teamId,
			name: name,
			memberIds: membership === "auto" ? undefined : membership,
			isTeamStream: membership === "auto",
			privacy: membership === "auto" ? "public" : privacy,
			purpose: purpose,
			...service
		})).stream as CSChannelStream;
	}

	async createDirectStream(
		membership: string[],
		teamId?: string
	): Promise<CSDirectStream | undefined> {
		return (await this._codestream.createStream(this._token, {
			type: StreamType.Direct,
			teamId: teamId || this._teamId,
			memberIds: membership
		})).stream as CSDirectStream;
	}

	async createFileStream(
		relativeUri: Uri,
		repoId: string,
		teamId?: string
	): Promise<CSFileStream | undefined>;
	async createFileStream(
		relativePath: string,
		repoId: string,
		teamId?: string
	): Promise<CSFileStream | undefined>;
	async createFileStream(
		relativeUriOrPath: Uri | string,
		repoId: string,
		teamId?: string
	): Promise<CSFileStream | undefined> {
		let relativePath;
		if (typeof relativeUriOrPath === "string") {
			relativePath = relativeUriOrPath;
		} else {
			if (relativeUriOrPath.scheme === "file" || relativeUriOrPath.scheme === "vsls") {
				relativePath = relativeUriOrPath.path;
				if (relativePath[0] === "/") {
					relativePath = relativePath.substr(1);
				}
			} else {
				relativePath = relativeUriOrPath.toString();
			}
		}

		return (await this._codestream.createStream(this._token, {
			type: StreamType.File,
			teamId: teamId || this._teamId,
			repoId: repoId,
			file: relativePath
		})).stream as CSFileStream;
	}

	async deletePost(streamId: string, postId: string, teamId?: string) {
		const changes = (await this._codestream.deletePost(this._token, teamId || this._teamId, postId))
			.post;
		return await this._cache.resolvePost(changes);
	}

	async editPost(streamId: string, postId: string, text: string, mentionedUserIds: string[]) {
		const changes = (await this._codestream.editPost(this._token, {
			id: postId,
			streamId,
			text,
			mentionedUserIds
		})).post;
		return await this._cache.resolvePost(changes);
	}

	async reactToPost(streamId: string, postId: string, emoji: string, value: boolean) {
		const post = await Container.agent.reactToPost(streamId, postId, emoji, value);
		return await this._cache.resolvePost(post);
	}

	async markPostUnread(streamId: string, postId: string) {
		const changes = (await this._codestream.markPostUnread(this._token, { id: postId, streamId })).post;
		return await this._cache.resolvePost(changes);
	}

	async getMarker(markerId: string, teamId?: string): Promise<CSMarker> {
		return (await this._codestream.getMarker(this._token, teamId || this._teamId, markerId)).marker;
	}

	async getMarkers(commitHash: string, streamId: string, teamId?: string): Promise<CSMarker[]> {
		return (await this._codestream.getMarkers(this._token, teamId || this._teamId, streamId))
			.markers;
	}

	async getMarkerLocations(
		commitHash: string,
		streamId: string,
		teamId?: string
	): Promise<CSMarkerLocations> {
		return (await this._codestream.getMarkerLocations(
			this._token,
			teamId || this._teamId,
			streamId,
			commitHash
		)).markerLocations;
	}

	async getPost(streamId: string, postId: string, teamId?: string): Promise<CSPost> {
		return (await this._codestream.getPost(this._token, teamId || this._teamId, postId)).post;
	}

	async getLatestPost(streamId: string, teamId?: string): Promise<CSPost> {
		const posts = (await this._codestream.getLatestPost(
			this._token,
			teamId || this._teamId,
			streamId
		)).posts;
		return posts[0];
	}

	async getPostsInRange(
		streamId: string,
		start: number,
		end: number,
		teamId?: string
	): Promise<CSPost[]> {
		return (await this._codestream.getPostsInRange(
			this._token,
			teamId || this._teamId,
			streamId,
			`${start}-${end}`
		)).posts;
	}

	async getPosts(
		streamId: string,
		limit?: number,
		beforeSeq?: number,
		teamId?: string
	): Promise<CSPost[]> {
		if (limit !== undefined) {
			return Container.agent.getPosts(streamId, limit, beforeSeq);
		}

		return (await this._codestream.getPosts(this._token, teamId || this._teamId, streamId)).posts;
	}

	async getRepo(repoId: string, teamId?: string): Promise<CSRepository | undefined> {
		return (await this._codestream.getRepo(this._token, teamId || this._teamId, repoId)).repo;
	}

	async getRepos(teamId?: string): Promise<CSRepository[]> {
		return (await this._codestream.getRepos(this._token, teamId || this._teamId)).repos;
	}

	async getStream(streamId: string, teamId?: string): Promise<CSStream | undefined> {
		return (await this._codestream.getStream(this._token, teamId || this._teamId, streamId)).stream;
	}

	async getUnreadStreams(teamId?: string): Promise<CSStream[]> {
		return (await this._codestream.getUnreadStreams(this._token, teamId || this._teamId)).streams;
	}

	async getChannelStreams(teamId?: string): Promise<CSChannelStream[]> {
		return (await this._codestream.getStreams<CSChannelStream>(
			this._token,
			teamId || this._teamId
		)).streams.filter(s => s.type === StreamType.Channel);
	}

	async getChannelOrDirectStreams(teamId?: string): Promise<(CSChannelStream | CSDirectStream)[]> {
		return (await this._codestream.getStreams<CSChannelStream | CSDirectStream>(
			this._token,
			teamId || this._teamId
		)).streams.filter(s => s.type === StreamType.Channel || s.type === StreamType.Direct);
	}

	async getDirectStreams(teamId?: string): Promise<CSDirectStream[]> {
		return (await this._codestream.getStreams<CSDirectStream>(
			this._token,
			teamId || this._teamId
		)).streams.filter(s => s.type === StreamType.Direct);
	}

	async getFileStreams(repoId: string, teamId?: string): Promise<CSFileStream[]> {
		return (await this._codestream.getStreams<CSFileStream>(
			this._token,
			teamId || this._teamId,
			repoId
		)).streams;
	}

	async getTeam(teamId: string): Promise<CSTeam | undefined> {
		return (await this._codestream.getTeam(this._token, teamId)).team;
	}

	async getTeams(ids: string[]): Promise<CSTeam[]> {
		return (await this._codestream.getTeams(this._token, ids)).teams;
	}

	async getUser(userId: string, teamId?: string): Promise<CSUser | undefined> {
		return (await this._codestream.getUser(this._token, teamId || this._teamId, userId)).user;
	}

	async getUsers(teamId?: string): Promise<CSUser[]> {
		return (await this._codestream.getUsers(this._token, teamId || this._teamId)).users;
	}

	async joinStream(streamId: string, teamId?: string): Promise<CSStream> {
		await Container.agent.joinStream(teamId || this._teamId, streamId);
		// Hack: because the response to the previous call is a $directive
		return (await this._codestream.getStream(this._token, teamId || this._teamId, streamId)).stream;
	}

	async updateStream(streamId: string, update: object): Promise<CSStream> {
		await this._codestream.updateStream(this._token, streamId, update);
		// Hack: because the response to the previous call is a $directive
		return (await this._codestream.getStream(this._token, this._teamId, streamId)).stream;
	}

	async updatePresence(status: PresenceStatus, sessionId: string) {
		return (await this._codestream.updatePresence(this._token, {
			sessionId: sessionId,
			status: status
		})).awayTimeout;
	}

	async markStreamRead(streamId: string) {
		return await this._codestream.markStreamRead(this._token, streamId);
	}
}
