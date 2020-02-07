// this is not used for the bot-based MS Teams sharing

"use strict";
import { Client, ClientOptions, GraphError, GraphRequest } from "@microsoft/microsoft-graph-client";
import { RequestInit } from "node-fetch";
import { ServerError } from "../../agentError";
import { SessionContainer } from "../../container";
import { Logger } from "../../logger";
import {
	Capabilities,
	CreatePostResponse,
	CreateSharedExternalPostRequest,
	FetchStreamsRequest,
	FetchStreamsResponse,
	FetchUsersResponse,
	GetUserRequest
} from "../../protocol/agent.protocol";
import {
	CSCodemark,
	CSGetMeResponse,
	CSMarkerLocations,
	CSMe,
	CSMSTeamsProviderInfo,
	CSTeam,
	CSUser,
	ProviderType,
	StreamType
} from "../../protocol/api.protocol";
import { Arrays, debug, Functions, Iterables, log } from "../../system";
import { ApiProviderLoginResponse, CodeStreamApiMiddleware, MessageType } from "../apiProvider";
import { CodeStreamApiProvider } from "../codestream/codestreamApi";
import {
	fromPostId,
	fromTeamsChannel,
	fromTeamsMessage,
	fromTeamsUser,
	GraphBatchRequest,
	GraphBatchResponse,
	TeamsMessageAttachment,
	TeamsMessageBody,
	TeamsMessageMention,
	toTeamsMessageBody,
	toTeamsTeam,
	toTeamsText,
	UserInfo
} from "./teamsSharingApi.adapters";

export class MSTeamsSharingApiProvider {
	private _teams: Client;
	private _providerInfo: CSMSTeamsProviderInfo;
	private _userInfosById: Map<string, UserInfo> | undefined;
	private _userIdsByName: Map<string, string> | undefined;
	private readonly _teamsUserId: string;

	readonly capabilities: Capabilities = {
		channelMute: false,
		postDelete: false,
		postEdit: false,
		providerCanSupportRealtimeChat: false,
		providerSupportsRealtimeChat: false,
		providerSupportsRealtimeEvents: false
	};

	providerType = ProviderType.MSTeams;

	constructor(
		private _codestream: CodeStreamApiProvider,
		private _codestreamTeam: CSTeam | undefined,
		providerInfo: CSMSTeamsProviderInfo,
		private readonly _codestreamUserId: string,
		private readonly _codestreamTeamId: string,
		private _teamsById: Map<string, string> | undefined
	) {
		this._providerInfo = providerInfo;
		this._teams = this.newClient();

		// TODO: Figure out how to get the proxy to work
		this._teamsUserId = providerInfo.userId;
	}

	private _refreshPromise: Promise<string> | undefined;
	private async getAccessToken() {
		const oneMinuteBeforeExpiration = this._providerInfo.expiresAt - 1000 * 60;
		if (oneMinuteBeforeExpiration <= new Date().getTime()) {
			if (this._refreshPromise === undefined) {
				try {
					this._refreshPromise = this.refreshAccessToken();
					const accessToken = await this._refreshPromise;
					this._refreshPromise = undefined;
					return accessToken;
				} finally {
					this._refreshPromise = undefined;
				}
			} else {
				return this._refreshPromise;
			}
		}

		return this._providerInfo.accessToken;
	}

	@debug()
	private async refreshAccessToken() {
		const cc = Logger.getCorrelationContext();

		try {
			const providerInfo = await this._codestream.refreshAuthProvider(
				"msteams",
				this._providerInfo
			);
			this._providerInfo = providerInfo;

			return this._providerInfo.accessToken;
		} catch (ex) {
			Logger.error(ex, cc);
			throw ex;
		}
	}

	protected newClient() {
		const clientOptions: ClientOptions = {
			authProvider: {
				getAccessToken: this.getAccessToken.bind(this)
			}
		};
		return Client.initWithMiddleware(clientOptions);
	}

	async processLoginResponse(response: ApiProviderLoginResponse): Promise<void> {
		if (!this.capabilities.providerSupportsRealtimeEvents) {
			// Turn off post caching if the provider doesn't support real-time events
			SessionContainer.instance().posts.disableCache();
		}

		// Mix in teams user info with ours
		const meResponse = await this.getMeCore({ user: response.user });

		const teamsResponse = await this.teamsApiCall<{ value: any[] }>(
			"v1.0/me/joinedTeams",
			request => request.get()
		);

		this._teamsById = new Map(
			teamsResponse.value.map<[string, string]>(t => [t.id, t.displayName])
		);

		// TODO: Correlate codestream ids to teams ids once the server returns that info
		// const users = await this._codestream.fetchUsers({});
		// users;

		const team = response.teams.find(t => t.id === this._codestreamTeamId);
		this._codestreamTeam = team;
		if (team !== undefined) {
			toTeamsTeam(team, await this.ensureUserInfosById());
		}

		response.user = meResponse.user;
	}

	get codestreamUserId(): string {
		return this._codestreamUserId!;
	}

	get teamId(): string {
		return this._codestreamTeamId!;
	}

	get userId(): string {
		return this._teamsUserId;
	}

	@log()
	fetch<R extends object>(url: string, init?: RequestInit, token?: string) {
		return this._codestream.fetch<R>(url, init, token);
	}

	useMiddleware(middleware: CodeStreamApiMiddleware) {
		return this._codestream.useMiddleware(middleware);
	}

	async login(): Promise<ApiProviderLoginResponse> {
		throw new Error("Not supported");
	}

	async ensureUserInfosById(): Promise<Map<string, UserInfo>> {
		if (this._userInfosById === undefined) {
			void (await this.ensureUserMaps());
		}
		return this._userInfosById!;
	}

	private async ensureUserIdsByName(): Promise<Map<string, string>> {
		if (this._userIdsByName === undefined) {
			void (await this.ensureUserMaps());
		}

		return this._userIdsByName!;
	}

	private async ensureUserMaps(): Promise<void> {
		if (this._userInfosById === undefined || this._userIdsByName === undefined) {
			const users = (await SessionContainer.instance().users.get()).users;

			this._userInfosById = new Map();
			this._userIdsByName = new Map();

			for (const user of users) {
				this._userInfosById.set(user.id, {
					username: user.username,
					displayName: user.fullName,
					type: "aadUser"
				});
				this._userIdsByName.set(user.username, user.id);
			}
		}
	}

	@log()
	getMe() {
		return this.getMeCore();
	}

	private async getMeCore(meResponse?: CSGetMeResponse) {
		if (meResponse === undefined) {
			meResponse = await this._codestream.getMe();
		}

		// Only get the data if we already have it cached (otherwise we'll loop infinitely 😀)
		const { users } = SessionContainer.instance();
		const prevMe = users.cached
			? ((await users.getByIdFromCache(this._teamsUserId)) as CSMe)
			: undefined;

		let me = meResponse.user;
		me.codestreamId = me.id;
		me.id = this.userId;

		const response = await this.teamsApiCall(
			"v1.0/me?$select=id,createdDateTime,deletedDateTime,mail,givenName,displayName,surname",
			request => request.get()
		);

		// Don't need to pass the codestream users here, since we set the codestreamId already above
		const user = fromTeamsUser(response, this._codestreamTeamId, []);
		me = {
			...me,
			avatar: user.avatar,
			// creatorId: user.id,
			deactivated: user.deactivated,
			email: user.email || me.email,
			firstName: user.firstName,
			fullName: user.fullName,
			id: user.id,
			lastName: user.lastName,
			username: user.username,
			presence: prevMe && prevMe.presence
		};

		if (me.lastReads == null) {
			me.lastReads = {};
		}

		// users.resolve({ type: MessageType.Users, data: [me] });

		return { user: me };
	}

	@log()
	async createExternalPost(request: CreateSharedExternalPostRequest): Promise<CreatePostResponse> {
		let createdPostId;
		try {
			const userInfosById = await this.ensureUserInfosById();
			const userIdsByName = await this.ensureUserIdsByName();

			const mentions: TeamsMessageMention[] = [];

			let text = request.text;
			if (text) {
				text = toTeamsText(text, request.mentionedUserIds, userInfosById, userIdsByName, mentions);
			}

			const { teamId, channelId, messageId: parentMessageId } = fromPostId(
				request.parentPostId,
				request.channelId!
			);

			const attachments: TeamsMessageAttachment[] = [];
			let body: TeamsMessageBody;
			let codemark: CSCodemark | undefined;

			if (request.codemark != null) {
				if (!text) {
					text = request.codemark.text || request.codemark.title || "";
				}

				({ codemark } = request);

				body = toTeamsMessageBody(
					codemark!,
					request.remotes,
					request.mentionedUserIds,
					userInfosById,
					userIdsByName,
					mentions,
					attachments
				);
			} else {
				body = { contentType: "text", content: text };
			}

			const response = await this.teamsApiCall<any>(
				`beta/teams/${teamId}/channels/${channelId}/messages${
					parentMessageId ? `/${parentMessageId}/replies` : ""
				}`,
				(request, content) => request.post(content),
				{
					body: body,
					attachments: attachments.length === 0 ? undefined : attachments,
					mentions: mentions.length === 0 ? undefined : mentions
				}
			);

			const post = await fromTeamsMessage(
				response,
				channelId,
				teamId,
				userInfosById,
				this._codestreamTeamId
			);
			createdPostId = post.id;

			return {
				post: post
			};
		} catch (ex) {
			debugger;
			throw ex;
		} finally {
			if (createdPostId) {
				this._codestream.trackProviderPost({
					provider: "msteams",
					teamId: this.teamId,
					streamId: request.channelId,
					postId: createdPostId,
					parentPostId: request.parentPostId
				});
			}
		}
	}

	@log({
		exit: (r: FetchStreamsResponse) =>
			`\n${r.streams
				.map(s => `\t${s.id} = ${s.name}, p=${s.priority == null ? "" : s.priority}`)
				.join("\n")}`
	})
	async fetchStreams(request: FetchStreamsRequest): Promise<FetchStreamsResponse> {
		const cc = Logger.getCorrelationContext();

		try {
			const requests: GraphBatchRequest[] = [
				...Iterables.map(this._teamsById!.keys(), id => ({
					id: id,
					method: "GET",
					url: `teams/${id}/channels`
				}))
			];
			const response = await this.teamsApiCallBatch("v1.0/$batch", requests);

			const streams = [
				...Iterables.flatMap(response.responses, r =>
					r.body!.value!.map(c =>
						fromTeamsChannel(c, r.id, this._teamsUserId, this._codestreamTeamId, this._teamsById!)
					)
				)
			];

			if (
				request.types != null &&
				request.types.length !== 0 &&
				(!request.types.includes(StreamType.Channel) || !request.types.includes(StreamType.Direct))
			) {
				return { streams: streams.filter(s => request.types!.includes(s.type)) };
			}

			return { streams: streams };
		} catch (ex) {
			Logger.error(ex, cc);
			throw ex;
		}
	}

	private _userIdMap: Map<string, string> | undefined;
	convertUserIdToCodeStreamUserId(id: string): string {
		if (this._userIdMap === undefined) return id;

		return this._userIdMap.get(id) || id;
	}

	@log()
	async fetchUsers(): Promise<FetchUsersResponse> {
		const requests: GraphBatchRequest[] = [
			...Iterables.map(this._teamsById!.keys(), id => ({
				id: id,
				method: "GET",
				url: `groups/${id}/members?$select=id,createdDateTime,deletedDateTime,mail,givenName,displayName,surname&$top=100`
			}))
		];

		const [response, { user: me }, { users: codestreamUsers }] = await Promise.all([
			this.teamsApiCallBatch("v1.0/$batch", requests),
			this.getMeCore(),
			(this._codestreamTeam !== undefined
				? Promise.resolve({ team: this._codestreamTeam })
				: this._codestream.getTeam({ teamId: this._codestreamTeamId })
			).then(({ team }) =>
				this._codestream.fetchUsers({
					userIds: team.memberIds
				})
			)
		]);

		const usersById = new Map<string, CSUser>();

		for (const r of response.responses) {
			for (const m of r.body!.value!) {
				if (usersById.has(m.id)) continue;

				// Find ourselves and replace it with our model
				if (m.id === this._teamsUserId) {
					usersById.set(m.id, me);
				}
				// Don't filter out deactivated users anymore to allow codemark by deleted users to show up properly
				// } else if (m.deletedDateTime == null) {
				else {
					usersById.set(m.id, fromTeamsUser(m, this._codestreamTeamId, codestreamUsers));
				}
			}
		}

		const users = [...usersById.values()];
		this._userIdMap = new Map(
			users
				.filter(u => u.codestreamId !== undefined)
				.map<[string, string]>(u => [u.codestreamId!, u.id])
		);

		return { users: users };
	}

	@log()
	async getUser(request: GetUserRequest) {
		if (request.userId === this.userId) {
			return this.getMe();
		}

		// HACK: Forward to CodeStream if this isn't a teams user id
		if (!request.userId.includes("-")) {
			return this._codestream.getUser(request);
		}

		const [response, { users: codestreamUsers }] = await Promise.all([
			this.teamsApiCall(
				`v1.0/users/${request.userId}?$select=id,createdDateTime,deletedDateTime,mail,givenName,displayName,surname`,
				request => request.get()
			),
			(this._codestreamTeam !== undefined
				? Promise.resolve({ team: this._codestreamTeam })
				: this._codestream.getTeam({ teamId: this._codestreamTeamId })
			).then(({ team }) =>
				this._codestream.fetchUsers({
					userIds: team.memberIds
				})
			)
		]);

		const user = fromTeamsUser(response, this._codestreamTeamId, codestreamUsers);

		return { user: user };
	}

	@debug<MSTeamsSharingApiProvider, MSTeamsSharingApiProvider["teamsApiCall"]>({
		args: {
			0: () => false,
			1: () => false
		},
		prefix: (context, path) => `${context.prefix} ${path}`
	})
	protected async teamsApiCall<TResponse>(
		path: string,
		fn: (request: GraphRequest, content?: any) => Promise<TResponse>,
		content?: any
	): Promise<TResponse> {
		const cc = Logger.getCorrelationContext();

		const timeoutMs = 30000;
		try {
			const response = await Functions.cancellable(
				fn(this._teams.api(`https://graph.microsoft.com/${path}`), content),
				timeoutMs,
				{
					onDidCancel: () => Logger.warn(cc, `TIMEOUT ${timeoutMs / 1000}s exceeded`)
				}
			);

			return response as TResponse;
		} catch (ex) {
			if (ex instanceof GraphError) {
				const data = ex;
				ex = new ServerError(data.message || "Unknown Error", data, data.statusCode);
				Logger.error(ex, cc, JSON.stringify(data));
			} else {
				Logger.error(ex, cc, ex.data != null ? JSON.stringify(ex.data) : undefined);
			}

			throw ex;
		}
	}

	@debug<MSTeamsSharingApiProvider, MSTeamsSharingApiProvider["teamsApiCallBatch"]>({
		args: {
			0: () => false,
			1: (requests: GraphBatchRequest[]) =>
				`${requests.length}:\n${requests.map(r => r.url).join("\n")}`
		},
		prefix: (context, path) => `${context.prefix} ${path}`
	})
	protected async teamsApiCallBatch(
		path: string,
		requests: GraphBatchRequest[]
	): Promise<{ responses: GraphBatchResponse[] }> {
		const cc = Logger.getCorrelationContext();

		const timeoutMs = 30000;
		try {
			if (requests.length < 20) {
				const response = await Functions.cancellable<{ responses: GraphBatchResponse[] }>(
					this._teams.api(`https://graph.microsoft.com/${path}`).post({ requests: requests }),
					timeoutMs * requests.length,
					{
						onDidCancel: () => Logger.warn(cc, `TIMEOUT ${timeoutMs / 1000}s exceeded`)
					}
				);

				return response;
			}

			const chunks = Arrays.chunk(requests, 19);
			const chunkedResponses = await Functions.cancellable(
				Promise.all<{ responses: GraphBatchResponse[] }>(
					chunks.map(c =>
						this._teams.api(`https://graph.microsoft.com/${path}`).post({ requests: c })
					)
				),
				timeoutMs * 19 * chunks.length,
				{
					onDidCancel: () => Logger.warn(cc, `TIMEOUT ${timeoutMs / 1000}s exceeded`)
				}
			);

			const responses = ([] as GraphBatchResponse[]).concat(
				...chunkedResponses.map(r => r.responses)
			);
			return { responses: responses };
		} catch (ex) {
			if (ex instanceof GraphError) {
				const data = ex;
				ex = new ServerError(data.message || "Unknown Error", data, data.statusCode);
				Logger.error(ex, cc, JSON.stringify(data));
			} else {
				Logger.error(ex, cc, ex.data != null ? JSON.stringify(ex.data) : undefined);
			}

			throw ex;
		}
	}

	async dispose() {}
}
