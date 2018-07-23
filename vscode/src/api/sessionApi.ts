"use strict";
import { MessageItem, Uri, window } from "vscode";
import { Container } from "../container";
import { GitRepository } from "../git/gitService";
import {
	CodeStreamApi,
	CreatePostRequestCodeBlock,
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

export class CodeStreamSessionApi {
	constructor(
		private readonly _api: CodeStreamApi,
		private readonly token: string,
		private readonly teamId: string
	) {}

	async savePreferences(preferences: {}) {
		await this._api.savePreferences(this.token, preferences);
		return this.getMe();
	}

	async getMe() {
		return (await this._api.getMe(this.token)).user;
	}

	async addUserToStream(streamId: string, userId: string, teamId?: string) {
		return (await this._api.updateStreamMembership(this.token, teamId || this.teamId, streamId, {
			$push: userId
		})).stream;
	}

	async invite(email: string, teamId: string, fullName?: string): Promise<CSUser> {
		return (await this._api.invite(this.token, { email, teamId, fullName })).user;
	}

	async createPost(
		text: string,
		parentPostId: string | undefined,
		streamId: string,
		teamId?: string
	): Promise<CSPost | undefined> {
		return (await this._api.createPost(this.token, {
			teamId: teamId || this.teamId,
			streamId: streamId,
			text: text,
			parentPostId
		})).post;
	}

	async createPostWithCode2(
		text: string,
		parentPostId: string | undefined,
		streamId: string,
		teamId: string,
		commitHashWhenPosted: string | undefined,
		codeBlocks: CreatePostRequestCodeBlock[]
	) {
		try {
			return (await this._api.createPost(this.token, {
				teamId: teamId || this.teamId,
				streamId,
				text,
				parentPostId,
				codeBlocks,
				commitHashWhenPosted
			})).post;
		} catch (e) {
			debugger;
			return;
		}
	}

	async createPostWithCode(
		text: string,
		parentPostId: string | undefined,
		code: string,
		location: [number, number, number, number],
		commitHash: string,
		fileStream: string | { file: string; repoId: string },
		streamId: string,
		teamId?: string
	): Promise<CSPost | undefined> {
		const codeBlock: CreatePostRequestCodeBlock = {
			code: code,
			location
		};

		if (typeof fileStream === "string") {
			codeBlock.streamId = fileStream;
		} else {
			codeBlock.file = fileStream.file;
			codeBlock.repoId = fileStream.repoId;
		}

		try {
			return (await this._api.createPost(this.token, {
				teamId: teamId || this.teamId,
				streamId: streamId,
				text: text,
				parentPostId,
				codeBlocks: [codeBlock],
				commitHashWhenPosted: commitHash
			})).post;
		} catch (e) {
			debugger;
			return;
		}
	}

	async createRepo(
		uri: Uri,
		firstCommitHashes: string[],
		teamId?: string
	): Promise<CSRepository | undefined> {
		return (await this._api.createRepo(this.token, {
			teamId: teamId || this.teamId,
			url: uri.toString(),
			knownCommitHashes: firstCommitHashes
		})).repo;
	}

	async createChannelStream(
		name: string,
		membership?: "auto" | string[],
		privacy: "public" | "private" = membership === "auto" ? "public" : "private",
		teamId?: string
	): Promise<CSChannelStream | undefined> {
		return (await this._api.createStream(this.token, {
			type: StreamType.Channel,
			teamId: teamId || this.teamId,
			name: name,
			memberIds: membership === "auto" ? undefined : membership,
			isTeamStream: membership === "auto",
			privacy: membership === "auto" ? "public" : privacy
		})).stream as CSChannelStream;
	}

	async createDirectStream(
		membership: string[],
		teamId?: string
	): Promise<CSDirectStream | undefined> {
		return (await this._api.createStream(this.token, {
			type: StreamType.Direct,
			teamId: teamId || this.teamId,
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

		return (await this._api.createStream(this.token, {
			type: StreamType.File,
			teamId: teamId || this.teamId,
			repoId: repoId,
			file: relativePath
		})).stream as CSFileStream;
	}

	async deletePost(postId: string, teamId?: string) {
		return (await this._api.deletePost(this.token, teamId || this.teamId, postId)).post;
	}

	async editPost(postId: string, text: string, mentionedUserIds: string[]) {
		return (await this._api.editPost(this.token, { id: postId, text, mentionedUserIds })).post;
	}

	deleteTeamContent(
		newerThan: number | undefined,
		includeStreams: boolean = false,
		teamId?: string
	) {
		return this._api.deleteTeamContent(this.token, {
			teamId: teamId || this.teamId,
			newerThan: newerThan,
			includeStreams: includeStreams
		});
	}

	private async findOrRegisterRepo(repo: GitRepository, registeredRepos: CSRepository[]) {
		const [firsts, remote] = await Promise.all([repo.getFirstCommits(), repo.getRemote()]);

		if (remote === undefined || firsts.length === 0) return undefined;

		const remoteUrl = remote.normalizedUrl;
		// TODO: What should we do if there are no remotes? skip?
		if (remoteUrl === undefined) return undefined;

		const found = await registeredRepos.find(r => r.normalizedUrl === remoteUrl);
		if (found !== undefined) return found;

		const actions: MessageItem[] = [
			{ title: "Add Repository" },
			{ title: "Skip", isCloseAffordance: true }
		];

		const result = await window.showInformationMessage(
			`The repository with url \`${remote.uri.toString()}\` isn't currently part of your team. Should we add it?`,
			...actions
		);
		if (result === actions[0]) {
			return await this.createRepo(remote.uri, firsts);
		}

		return undefined;
	}

	async findOrRegisterRepos(): Promise<[Uri, CSRepository][]> {
		const [registeredRepos, repos] = await Promise.all([
			this.getRepos(),
			Container.git.getRepositories()
		]);

		const items: [Uri, CSRepository][] = [];

		let found;
		for (const repo of repos) {
			found = await this.findOrRegisterRepo(repo, registeredRepos);
			if (found === undefined) continue;

			items.push([repo.uri, found]);
		}

		return items;
	}

	async getMarker(markerId: string, teamId?: string): Promise<CSMarker> {
		return (await this._api.getMarker(this.token, teamId || this.teamId, markerId)).marker;
	}

	async getMarkers(commitHash: string, stream: CSStream): Promise<CSMarker[]>;
	async getMarkers(commitHash: string, streamId: string, teamId?: string): Promise<CSMarker[]>;
	async getMarkers(commitHash: string, streamOrStreamId: CSStream | string, teamId?: string) {
		let streamId;
		if (typeof streamOrStreamId === "string") {
			streamId = streamOrStreamId;
			teamId = teamId || this.teamId;
		} else {
			streamId = streamOrStreamId.id;
			teamId = streamOrStreamId.teamId;
		}
		return (await this._api.getMarkers(this.token, teamId, streamId)).markers;
	}

	async getMarkerLocations(commitHash: string, stream: CSStream): Promise<CSMarkerLocations>;
	async getMarkerLocations(
		commitHash: string,
		streamId: string,
		teamId?: string
	): Promise<CSMarkerLocations>;
	async getMarkerLocations(
		commitHash: string,
		streamOrStreamId: CSStream | string,
		teamId?: string
	) {
		let streamId;
		if (typeof streamOrStreamId === "string") {
			streamId = streamOrStreamId;
			teamId = teamId || this.teamId;
		} else {
			streamId = streamOrStreamId.id;
			teamId = streamOrStreamId.teamId;
		}
		return (await this._api.getMarkerLocations(this.token, teamId, streamId, commitHash))
			.markerLocations;
	}

	async getPost(postId: string, teamId?: string): Promise<CSPost> {
		return (await this._api.getPost(this.token, teamId || this.teamId, postId)).post;
	}

	async getPosts(stream: CSStream): Promise<CSPost[]>;
	async getPosts(streamId: string, teamId?: string): Promise<CSPost[]>;
	async getPosts(streamOrStreamId: CSStream | string, teamId?: string): Promise<CSPost[]> {
		let streamId;
		if (typeof streamOrStreamId === "string") {
			streamId = streamOrStreamId;
			teamId = teamId || this.teamId;
		} else {
			streamId = streamOrStreamId.id;
			teamId = streamOrStreamId.teamId;
		}
		return (await this._api.getPosts(this.token, teamId, streamId)).posts;
	}

	async getRepo(repoId: string, team?: CSTeam): Promise<CSRepository | undefined>;
	async getRepo(repoId: string, teamId?: string): Promise<CSRepository | undefined>;
	async getRepo(repoId: string, teamOrTeamId?: CSTeam | string): Promise<CSRepository | undefined> {
		let teamId;
		if (teamOrTeamId === undefined) {
			teamId = this.teamId;
		} else if (typeof teamOrTeamId === "string") {
			teamId = teamOrTeamId;
		} else {
			teamId = teamOrTeamId.id;
		}
		return (await this._api.getRepo(this.token, teamId, repoId)).repo;
	}

	async getRepos(team?: CSTeam): Promise<CSRepository[]>;
	async getRepos(teamId?: string): Promise<CSRepository[]>;
	async getRepos(teamOrTeamId?: CSTeam | string): Promise<CSRepository[]> {
		let teamId;
		if (teamOrTeamId === undefined) {
			teamId = this.teamId;
		} else if (typeof teamOrTeamId === "string") {
			teamId = teamOrTeamId;
		} else {
			teamId = teamOrTeamId.id;
		}
		return (await this._api.getRepos(this.token, teamId)).repos;
	}

	async getStream(streamId: string, teamId?: string): Promise<CSStream | undefined> {
		return (await this._api.getStream(this.token, teamId || this.teamId, streamId)).stream;
	}

	async getChannelStreams(teamId?: string): Promise<CSChannelStream[]> {
		return (await this._api.getStreams<CSChannelStream>(
			this.token,
			teamId || this.teamId
		)).streams.filter(s => s.type === StreamType.Channel);
	}

	async getDirectStreams(teamId?: string): Promise<CSDirectStream[]> {
		return (await this._api.getStreams<CSDirectStream>(
			this.token,
			teamId || this.teamId
		)).streams.filter(s => s.type === StreamType.Direct);
	}

	async getFileStreams(repo: CSRepository): Promise<CSFileStream[]>;
	async getFileStreams(repoId: string, teamId?: string): Promise<CSFileStream[]>;
	async getFileStreams(
		repoOrRepoId: CSRepository | string,
		teamId?: string
	): Promise<CSFileStream[]> {
		let repoId;
		if (typeof repoOrRepoId === "string") {
			repoId = repoOrRepoId;
			teamId = teamId || this.teamId;
		} else {
			repoId = repoOrRepoId.id;
			teamId = repoOrRepoId.teamId;
		}
		return (await this._api.getStreams<CSFileStream>(this.token, teamId, repoId)).streams;
	}

	async getSubscribeableStreams(userId: string, teamId?: string): Promise<CSStream[]> {
		return (await this._api.getStreams<CSStream>(this.token, teamId || this.teamId)).streams.filter(
			s => CodeStreamApi.isStreamSubscriptionRequired(s, userId)
		);
	}

	async getTeam(teamId: string): Promise<CSTeam | undefined> {
		return (await this._api.getTeam(this.token, teamId)).team;
	}

	async getTeams(ids: string[]): Promise<CSTeam[]> {
		return (await this._api.getTeams(this.token, ids)).teams;
	}

	async getUser(userId: string, teamId?: string): Promise<CSUser | undefined> {
		return (await this._api.getUser(this.token, teamId || this.teamId, userId)).user;
	}

	async getUsers(teamId?: string): Promise<CSUser[]> {
		return (await this._api.getUsers(this.token, teamId || this.teamId)).users;
	}

	async joinStream(streamId: string, teamId?: string) {
		await this._api.joinStream(this.token, teamId || this.teamId, streamId, {});
		// Hack: because the response to the previous call is a $directive
		return (await this._api.getStream(this.token, teamId || this.teamId, streamId)).stream;
	}

	async updateStream(streamId: string, update: object) {
		await this._api.updateStream(this.token, streamId, update);
		// Hack: because the response to the previous call is a $directive
		return (await this._api.getStream(this.token, this.teamId, streamId)).stream;
	}

	async updatePresence(status: PresenceStatus, sessionId: string) {
		return (await this._api.updatePresence(this.token, {
			sessionId: sessionId,
			status: status
		})).awayTimeout;
	}

	async markStreamRead(streamId: string) {
		return await this._api.markStreamRead(this.token, streamId);
	}
}
