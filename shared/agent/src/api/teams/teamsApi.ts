"use strict";
import { Client, ClientOptions, GraphError, GraphRequest } from "@microsoft/microsoft-graph-client";
import { Agent as HttpsAgent } from "https";
import HttpsProxyAgent from "https-proxy-agent";
import { RequestInit } from "node-fetch";
import { Emitter, Event } from "vscode-languageserver";
import { ServerError } from "../../agentError";
import { SessionContainer } from "../../container";
import { Logger } from "../../logger";
import {
	AddEnterpriseProviderHostRequest,
	AddReferenceLocationRequest,
	AddReferenceLocationResponse,
	ArchiveStreamRequest,
	ArchiveStreamResponse,
	Capabilities,
	CloseStreamRequest,
	CloseStreamResponse,
	ConnectionStatus,
	CreateChannelStreamRequest,
	CreateChannelStreamResponse,
	CreateCodemarkPermalinkRequest,
	CreateCodemarkRequest,
	CreateDirectStreamRequest,
	CreateDirectStreamResponse,
	CreateExternalPostRequest,
	CreateMarkerLocationRequest,
	CreateMarkerRequest,
	CreatePostRequest,
	CreatePostResponse,
	CreateRepoRequest,
	DeleteCodemarkRequest,
	DeletePostRequest,
	DeletePostResponse,
	EditPostRequest,
	EditPostResponse,
	FetchCodemarksRequest,
	FetchCompaniesRequest,
	FetchCompaniesResponse,
	FetchFileStreamsRequest,
	FetchMarkerLocationsRequest,
	FetchMarkersRequest,
	FetchPostRepliesRequest,
	FetchPostRepliesResponse,
	FetchPostsRequest,
	FetchPostsResponse,
	FetchStreamsRequest,
	FetchStreamsResponse,
	FetchTeamsRequest,
	FetchUnreadStreamsRequest,
	FetchUsersRequest,
	FetchUsersResponse,
	FollowCodemarkRequest,
	FollowCodemarkResponse,
	GetCodemarkRequest,
	GetCompanyRequest,
	GetCompanyResponse,
	GetMarkerRequest,
	GetPostRequest,
	GetPostResponse,
	GetPostsRequest,
	GetPostsResponse,
	GetPreferencesResponse,
	GetRepoRequest,
	GetStreamRequest,
	GetTeamRequest,
	GetUnreadsRequest,
	GetUnreadsResponse,
	GetUserRequest,
	InviteUserRequest,
	JoinStreamRequest,
	JoinStreamResponse,
	LeaveStreamRequest,
	LeaveStreamResponse,
	MarkPostUnreadRequest,
	MarkPostUnreadResponse,
	MarkStreamReadRequest,
	MarkStreamReadResponse,
	MatchReposRequest,
	MuteStreamRequest,
	MuteStreamResponse,
	OpenStreamRequest,
	OpenStreamResponse,
	PinReplyToCodemarkRequest,
	ReactToPostRequest,
	ReactToPostResponse,
	RenameStreamRequest,
	RenameStreamResponse,
	SetCodemarkPinnedRequest,
	SetCodemarkStatusRequest,
	SetStreamPurposeRequest,
	SetStreamPurposeResponse,
	UnarchiveStreamRequest,
	UnarchiveStreamResponse,
	Unreads,
	UpdateCodemarkRequest,
	UpdateMarkerRequest,
	UpdatePreferencesRequest,
	UpdatePresenceRequest,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse,
	UpdateUserRequest
} from "../../protocol/agent.protocol";
import {
	CSApiCapabilities,
	CSCodemark,
	CSGetMeResponse,
	CSMarker,
	CSMarkerLocations,
	CSMe,
	CSMsTeamsConversationRequest,
	CSMSTeamsProviderInfo,
	CSPost,
	CSRepository,
	CSStream,
	CSTeam,
	CSUser,
	ProviderType,
	StreamType,
	TriggerMsTeamsProactiveMessageRequest
} from "../../protocol/api.protocol";
import { Arrays, debug, Functions, Iterables, log } from "../../system";
import {
	ApiProvider,
	ApiProviderLoginResponse,
	CodeStreamApiMiddleware,
	LoginOptions,
	MessageType,
	RTMessage
} from "../apiProvider";
import { CodeStreamApiProvider } from "../codestream/codestreamApi";
import { CodeStreamPreferences } from "../preferences";
import {
	fromPostId,
	fromStreamId,
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
} from "./teamsApi.adapters";
import { TeamsUnreads } from "./unreads";

export class MSTeamsApiProvider implements ApiProvider {
	getReview(
		request: import("../../protocol/agent.protocol.reviews").GetReviewRequest
	): Promise<import("../../protocol/agent.protocol.reviews").GetReviewResponse> {
		throw new Error("Method not implemented.");
	}
	fetchReviews(
		request: import("../../protocol/agent.protocol.reviews").FetchReviewsRequest
	): Promise<import("../../protocol/api.protocol").CSGetReviewsResponse> {
		throw new Error("Method not implemented.");
	}

	private _onDidReceiveMessage = new Emitter<RTMessage>();
	get onDidReceiveMessage(): Event<RTMessage> {
		return this._onDidReceiveMessage.event;
	}

	private _teams: Client;
	private readonly _codestreamUserId: string;
	private _codestreamTeam: CSTeam | undefined;
	private _providerInfo: CSMSTeamsProviderInfo;
	private readonly _teamsUserId: string;

	private _preferences: CodeStreamPreferences;
	private _teamsById: Map<string, string> | undefined;

	private readonly _unreads: TeamsUnreads;
	private _userInfosById: Map<string, UserInfo> | undefined;
	private _userIdsByName: Map<string, string> | undefined;

	readonly capabilities: Capabilities = {
		channelMute: false,
		postDelete: false,
		postEdit: false,
		providerCanSupportRealtimeChat: false,
		providerSupportsRealtimeChat: false,
		providerSupportsRealtimeEvents: false
	};

	get features() {
		return undefined;
	}

	providerType = ProviderType.MSTeams;

	constructor(
		private _codestream: CodeStreamApiProvider,
		providerInfo: CSMSTeamsProviderInfo,
		user: CSMe,
		private readonly _codestreamTeamId: string,
		private readonly _httpsAgent: HttpsAgent | HttpsProxyAgent | undefined
	) {
		this._providerInfo = providerInfo;
		this._teams = this.newClient();

		// TODO: Figure out how to get the proxy to work

		this._unreads = new TeamsUnreads(this);
		this._unreads.onDidChange(this.onUnreadsChanged, this);

		this._preferences = new CodeStreamPreferences(user.preferences);

		this._codestreamUserId = user.id;
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

	@log<MSTeamsApiProvider, MSTeamsApiProvider["onCodeStreamMessage"]>({
		prefix: (context, e) => `${context.prefix}(${e.type})`
	})
	private async onCodeStreamMessage(e: RTMessage) {
		const cc = Logger.getCorrelationContext();

		try {
			switch (e.type) {
				case MessageType.Connection:
					switch (e.data.status) {
						// case ConnectionStatus.Disconnected:
						// 	break;
						// case ConnectionStatus.Reconnecting:
						// 	break;
						case ConnectionStatus.Reconnected:
							if (e.data.reset) {
								void SessionContainer.instance().session.reset();
								// TODO: Handle reconnect to pubnub?
							}

							break;
					}
					break;

				case MessageType.Preferences:
					this._preferences.update(e.data);
					break;

				case MessageType.Users:
					let user = e.data.find(u =>
						u.codestreamId == null
							? u.id === this._teamsUserId
							: u.codestreamId === this._codestreamUserId
					);
					if (user === undefined) return;

					// this.getMe() will update the user's cache so no need to do it here
					({ user } = await this.getMe());
					this._onDidReceiveMessage.fire({ type: e.type, data: [user] });
					break;

				default:
					this._onDidReceiveMessage.fire(e);
			}
		} catch (ex) {
			Logger.error(ex, cc);
		}
	}

	private onUnreadsChanged(e: Unreads) {
		try {
			this._onDidReceiveMessage.fire({ type: MessageType.Unreads, data: e });
		} catch (ex) {
			Logger.error(ex);
		}
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

	get unreads(): TeamsUnreads {
		return this._unreads;
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

	async login(options: LoginOptions): Promise<ApiProviderLoginResponse> {
		throw new Error("Not supported");
	}

	@log()
	async subscribe(types?: MessageType[]) {
		this._preferences.onDidChange(preferences => {
			this._onDidReceiveMessage.fire({ type: MessageType.Preferences, data: preferences });
		});

		this.getInitialPreferences().then(preferences => {
			this._preferences.update(preferences);
		});

		this._codestream.onDidReceiveMessage(this.onCodeStreamMessage, this);
		await this._codestream.subscribe([
			MessageType.Codemarks,
			MessageType.Connection,
			MessageType.MarkerLocations,
			MessageType.Markers,
			MessageType.Preferences,
			MessageType.Repositories,
			MessageType.Users
		]);
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

	grantBroadcasterChannelAccess(token: string, channel: string): Promise<{}> {
		if (channel === `user-${this.userId}`) {
			channel = `user-${this.codestreamUserId}`;
		}

		return this._codestream.grantBroadcasterChannelAccess(token, channel);
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

		users.resolve({ type: MessageType.Users, data: [me] });

		return { user: me };
	}

	@log()
	getUnreads(request: GetUnreadsRequest): Promise<GetUnreadsResponse> {
		return Promise.resolve({ unreads: this._unreads.get() });
	}

	@log()
	updatePreferences(request: UpdatePreferencesRequest) {
		return this._codestream.updatePreferences(request);
	}

	@log()
	updatePresence(request: UpdatePresenceRequest) {
		return this._codestream.updatePresence(request);
	}

	@log()
	fetchFileStreams(request: FetchFileStreamsRequest) {
		return this._codestream.fetchFileStreams(request);
	}

	@log()
	createCodemark(request: CreateCodemarkRequest) {
		return this._codestream.createCodemark(request);
	}

	@log()
	deleteCodemark(request: DeleteCodemarkRequest) {
		return this._codestream.deleteCodemark(request);
	}

	@log()
	fetchCodemarks(request: FetchCodemarksRequest) {
		return this._codestream.fetchCodemarks(request);
	}

	@log()
	getCodemark(request: GetCodemarkRequest) {
		return this._codestream.getCodemark(request);
	}

	@log()
	setCodemarkPinned(request: SetCodemarkPinnedRequest) {
		return this._codestream.setCodemarkPinned(request);
	}

	@log()
	pinReplyToCodemark(request: PinReplyToCodemarkRequest) {
		return this._codestream.pinReplyToCodemark(request);
	}

	@log()
	followCodemark(request: FollowCodemarkRequest) {
		return this._codestream.followCodemark(request);
	}

	@log()
	async setCodemarkStatus(request: SetCodemarkStatusRequest) {
		return this._codestream.setCodemarkStatus(request);
	}

	@log()
	updateCodemark(request: UpdateCodemarkRequest) {
		return this._codestream.updateCodemark(request);
	}

	@log()
	createCodemarkPermalink(request: CreateCodemarkPermalinkRequest) {
		return this._codestream.createCodemarkPermalink(request);
	}

	@log()
	createMarkerLocation(request: CreateMarkerLocationRequest) {
		return this._codestream.createMarkerLocation(request);
	}

	@log()
	fetchMarkerLocations(request: FetchMarkerLocationsRequest) {
		return this._codestream.fetchMarkerLocations(request);
	}

	@log()
	addReferenceLocation(request: AddReferenceLocationRequest) {
		return this._codestream.addReferenceLocation(request);
	}

	@log()
	fetchMarkers(request: FetchMarkersRequest) {
		return this._codestream.fetchMarkers(request);
	}

	@log()
	getMarker(request: GetMarkerRequest) {
		return this._codestream.getMarker(request);
	}

	@log()
	updateMarker(request: UpdateMarkerRequest) {
		return this._codestream.updateMarker(request);
	}

	@log()
	moveMarker(request: { oldMarkerId: string; newMarker: CreateMarkerRequest }) {
		return this._codestream.moveMarker(request);
	}

	@log()
	fetchMsTeamsConversations(request: CSMsTeamsConversationRequest) {
		return this._codestream.fetchMsTeamsConversations(request);
	}

	@log()
	triggerMsTeamsProactiveMessage(request: TriggerMsTeamsProactiveMessageRequest) {
		return this._codestream.triggerMsTeamsProactiveMessage(request);
	}

	@log()
	async createPost(request: CreatePostRequest): Promise<CreatePostResponse> {
		throw new Error("Not supported");
	}

	@log()
	async createExternalPost(request: CreateExternalPostRequest): Promise<CreatePostResponse> {
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
				request.streamId!
			);

			const attachments: TeamsMessageAttachment[] = [];
			let body: TeamsMessageBody;
			let codemark: CSCodemark | undefined;
			let markers: CSMarker[] | undefined;
			let markerLocations: CSMarkerLocations[] | undefined;
			let streams: CSStream[] | undefined;
			let repos: CSRepository[] | undefined;

			if (request.codemarkResponse != null) {
				if (!text) {
					text =
						request.codemarkResponse.codemark.text || request.codemarkResponse.codemark.title || "";
				}

				({ codemark, markers, markerLocations, streams, repos } = request.codemarkResponse);

				body = toTeamsMessageBody(
					codemark,
					request.remotes,
					markers,
					markerLocations,
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
				post: post,
				codemark,
				markers,
				markerLocations,
				streams,
				repos
			};
		} catch (ex) {
			debugger;
			throw ex;
		} finally {
			if (createdPostId) {
				this._codestream.trackProviderPost({
					provider: "msteams",
					teamId: this.teamId,
					streamId: request.streamId,
					postId: createdPostId,
					parentPostId: request.parentPostId
				});
			}
		}
	}

	@log()
	async deletePost(request: DeletePostRequest): Promise<DeletePostResponse> {
		throw new Error("Not Supported");
	}

	@log()
	async editPost(request: EditPostRequest): Promise<EditPostResponse> {
		throw new Error("Not Supported");
	}

	@log()
	async fetchPostReplies(request: FetchPostRepliesRequest): Promise<FetchPostRepliesResponse> {
		const { teamId, channelId, messageId } = fromPostId(request.postId, request.streamId);

		const response = await this.teamsApiCall<{ value: any[] }>(
			`beta/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`,
			request => request.get()
		);

		// Ensure the correct ordering
		// messages.sort((a: any, b: any) => a.ts - b.ts);

		const userInfosById = await this.ensureUserInfosById();
		const posts = await Promise.all(
			response.value.map((m: any) =>
				fromTeamsMessage(m, channelId, teamId, userInfosById, this._codestreamTeamId)
			) as Promise<CSPost>[]
		);

		return { posts: posts };
	}

	@log()
	async fetchPosts(request: FetchPostsRequest): Promise<FetchPostsResponse> {
		return { posts: [], more: false };
	}

	@log()
	async getPost(request: GetPostRequest, parentPostId?: string): Promise<GetPostResponse> {
		const { teamId, channelId, messageId } = fromPostId(request.postId, request.streamId);

		let parentMessageId;
		if (parentPostId) {
			({ messageId: parentMessageId } = fromPostId(parentPostId, request.streamId));
		}

		let postResponse: any;
		let replyCount;
		if (parentMessageId) {
			postResponse = await this.teamsApiCall<any>(
				`beta/teams/${teamId}/channels/${channelId}/messages/${parentMessageId}/replies/${messageId}`,
				request => request.get()
			);
		} else {
			// Create a composite query to try to get if there are any replies
			const requests: GraphBatchRequest[] = [
				{
					id: "post",
					method: "GET",
					url: `teams/${teamId}/channels/${channelId}/messages/${messageId}`
				},
				{
					id: "replies",
					method: "GET",
					// Only get the first reply, since we can't use $count or $select with replies yet
					url: `teams/${teamId}/channels/${channelId}/messages/${messageId}/replies?$top=1`
				}
			];

			const response = await this.teamsApiCallBatch("beta/$batch", requests);

			postResponse = response.responses.find(r => r.id === "post")!.body!;
			const repliesResponse = response.responses.find(r => r.id === "replies")!;
			if (repliesResponse.body && repliesResponse.body.value && repliesResponse.body.value.length) {
				replyCount = 1;
			}
		}

		const userInfosById = await this.ensureUserInfosById();
		const post = await fromTeamsMessage(
			postResponse,
			channelId,
			teamId,
			userInfosById,
			this._codestreamTeamId,
			replyCount
		);

		return { post: post };
	}

	@log()
	async getPosts(request: GetPostsRequest): Promise<GetPostsResponse> {
		if (request.postIds.length === 1) {
			const response = await this.getPost(
				{ streamId: request.streamId, postId: request.postIds[0] },
				request.parentPostId
			);
			return { posts: [response.post] };
		}

		const requests: GraphBatchRequest[] = [
			...Iterables.map(request.postIds, postId => {
				const { teamId, channelId, messageId } = fromPostId(postId, request.streamId);

				let parentMessageId;
				if (request.parentPostId) {
					({ messageId: parentMessageId } = fromPostId(request.parentPostId, request.streamId));
				}

				return {
					id: messageId!,
					method: "GET",
					url: `teams/${teamId}/channels/${channelId}/messages/${
						parentMessageId ? `${parentMessageId}/replies/` : ""
					}${messageId}`
				};
			})
		];
		const response = await this.teamsApiCallBatch("beta/$batch", requests);

		const { teamId, channelId } = fromStreamId(request.streamId);
		const userInfosById = await this.ensureUserInfosById();

		const posts = await Promise.all(
			response.responses.map(r =>
				fromTeamsMessage(r.body!, channelId, teamId, userInfosById, this._codestreamTeamId)
			)
		);

		return { posts: posts };
	}

	@log()
	async markPostUnread(request: MarkPostUnreadRequest): Promise<MarkPostUnreadResponse> {
		return {};
	}

	@log()
	async reactToPost(request: ReactToPostRequest): Promise<ReactToPostResponse> {
		throw new Error("Not Supported");
	}

	@log()
	createRepo(request: CreateRepoRequest) {
		return this._codestream.createRepo(request);
	}

	@log()
	fetchRepos() {
		return this._codestream.fetchRepos();
	}

	@log()
	getRepo(request: GetRepoRequest) {
		return this._codestream.getRepo(request);
	}

	@log()
	matchRepos(request: MatchReposRequest) {
		return this._codestream.matchRepos(request);
	}

	@log()
	async createChannelStream(
		request: CreateChannelStreamRequest
	): Promise<CreateChannelStreamResponse> {
		throw new Error("Not Supported");
	}

	@log()
	async createDirectStream(
		request: CreateDirectStreamRequest
	): Promise<CreateDirectStreamResponse> {
		throw new Error("Not Supported");
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

	@log()
	async getPreferences(): Promise<GetPreferencesResponse> {
		return {
			preferences: this._preferences.get()
		};
	}

	@log()
	async getTelemetryKey(): Promise<string> {
		return this._codestream.getTelemetryKey();
	}

	@log()
	async getApiCapabilities(): Promise<CSApiCapabilities> {
		return this._codestream.getApiCapabilities();
	}

	@log()
	private async getInitialPreferences() {
		const { user } = await this.getMe();
		return user.preferences || {};
	}

	@log()
	async fetchUnreadStreams(request: FetchUnreadStreamsRequest) {
		return { streams: [] };
	}

	@log()
	async getStream(request: GetStreamRequest) {
		if (request.type === StreamType.File) {
			return this._codestream.getStream(request);
		}

		const { teamId, channelId } = fromStreamId(request.streamId);

		const response = await this.teamsApiCall(
			`v1.0/teams/${teamId}/channels/${channelId}`,
			request => request.get()
		);
		const channel = fromTeamsChannel(
			response,
			teamId,
			this._teamsUserId,
			this._codestreamTeamId,
			this._teamsById!
		);

		return { stream: channel };
	}

	@log()
	async archiveStream(request: ArchiveStreamRequest): Promise<ArchiveStreamResponse> {
		throw new Error("Not Supported");
	}

	@log()
	async closeStream(request: CloseStreamRequest): Promise<CloseStreamResponse> {
		throw new Error("Not Supported");
	}

	@log()
	async joinStream(request: JoinStreamRequest): Promise<JoinStreamResponse> {
		throw new Error("Not Supported");
	}

	@log()
	async leaveStream(request: LeaveStreamRequest): Promise<LeaveStreamResponse> {
		throw new Error("Not Supported");
	}

	@log()
	async markStreamRead(request: MarkStreamReadRequest): Promise<MarkStreamReadResponse> {
		throw new Error("Not Supported");
	}

	@log()
	async muteStream(request: MuteStreamRequest): Promise<MuteStreamResponse> {
		throw new Error("Not Supported");
	}

	@log()
	async openStream(request: OpenStreamRequest): Promise<OpenStreamResponse> {
		throw new Error("Not Supported");
	}

	@log()
	async renameStream(request: RenameStreamRequest): Promise<RenameStreamResponse> {
		throw new Error("Not Supported");
	}

	@log()
	async setStreamPurpose(request: SetStreamPurposeRequest): Promise<SetStreamPurposeResponse> {
		throw new Error("Not Supported");
	}

	@log()
	async unarchiveStream(request: UnarchiveStreamRequest): Promise<UnarchiveStreamResponse> {
		throw new Error("Not Supported");
	}

	@log()
	async updateStreamMembership(
		request: UpdateStreamMembershipRequest
	): Promise<UpdateStreamMembershipResponse> {
		throw new Error("Not Supported");
	}

	@log()
	async fetchTeams(request: FetchTeamsRequest) {
		const response = await this._codestream.fetchTeams(request);

		// Replace the current team's ids with slack ids
		const team = response.teams.find(t => t.id === this._codestreamTeamId);
		if (team !== undefined) {
			toTeamsTeam(team, await this.ensureUserInfosById());
		}

		return response;
	}

	@log()
	async getTeam(request: GetTeamRequest) {
		const response = await this._codestream.getTeam(request);

		// Replace the current team's ids with slack ids
		if (response.team != null && response.team.id === this._codestreamTeamId) {
			toTeamsTeam(response.team, await this.ensureUserInfosById());
		}

		return response;
	}

	private _userIdMap: Map<string, string> | undefined;
	convertUserIdToCodeStreamUserId(id: string): string {
		if (this._userIdMap === undefined) return id;

		return this._userIdMap.get(id) || id;
	}

	@log()
	async fetchUsers(request: FetchUsersRequest): Promise<FetchUsersResponse> {
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

	@log()
	inviteUser(request: InviteUserRequest) {
		return this._codestream.inviteUser(request);
	}

	@log()
	updateUser(request: UpdateUserRequest) {
		return this._codestream.updateUser(request);
	}

	@log()
	connectThirdPartyProvider(request: { providerId: string }) {
		return this._codestream.connectThirdPartyProvider(request);
	}

	@log()
	setThirdPartyProviderToken(request: { providerId: string; host: string; token: string }) {
		return this._codestream.setThirdPartyProviderToken(request);
	}

	@log()
	setThirdPartyProviderInfo(request: {
		providerId: string;
		host: string;
		data: { [key: string]: any };
	}) {
		return this._codestream.setThirdPartyProviderInfo(request);
	}

	@log()
	disconnectThirdPartyProvider(request: { providerId: string; providerTeamId?: string }) {
		return this._codestream.disconnectThirdPartyProvider(request);
	}

	@log()
	addEnterpriseProviderHost(request: AddEnterpriseProviderHostRequest) {
		return this._codestream.addEnterpriseProviderHost(request);
	}

	@log()
	refreshThirdPartyProvider(request: { providerId: string; refreshToken: string }): Promise<CSMe> {
		return this._codestream.refreshThirdPartyProvider(request);
	}

	fetchCompanies(request: FetchCompaniesRequest): Promise<FetchCompaniesResponse> {
		return this._codestream.fetchCompanies(request);
	}

	getCompany(request: GetCompanyRequest): Promise<GetCompanyResponse> {
		return this._codestream.getCompany(request);
	}

	@log()
	verifyConnectivity() {
		return this._codestream.verifyConnectivity();
	}

	@debug<MSTeamsApiProvider, MSTeamsApiProvider["teamsApiCall"]>({
		args: {
			0: () => false,
			1: () => false
		},
		prefix: (context, path, fn) => `${context.prefix} ${path}`
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
					onDidCancel: (resolve, reject) => Logger.warn(cc, `TIMEOUT ${timeoutMs / 1000}s exceeded`)
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

	@debug<MSTeamsApiProvider, MSTeamsApiProvider["teamsApiCallBatch"]>({
		args: {
			0: () => false,
			1: (requests: GraphBatchRequest[]) =>
				`${requests.length}:\n${requests.map(r => r.url).join("\n")}`
		},
		prefix: (context, path, fn) => `${context.prefix} ${path}`
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
						onDidCancel: (resolve, reject) =>
							Logger.warn(cc, `TIMEOUT ${timeoutMs / 1000}s exceeded`)
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
					onDidCancel: (resolve, reject) => Logger.warn(cc, `TIMEOUT ${timeoutMs / 1000}s exceeded`)
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

	async dispose() {
		await this._codestream.dispose();
	}
}
