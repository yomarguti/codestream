"use strict";
import { Client, ClientOptions, GraphRequest } from "@microsoft/microsoft-graph-client";
import HttpsProxyAgent from "https-proxy-agent";
import { RequestInit } from "node-fetch";
import { Emitter, Event } from "vscode-languageserver";
import { Container, SessionContainer } from "../../container";
import { Logger } from "../../logger";
import {
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
	CreateMarkerLocationRequest,
	CreatePostRequest,
	CreatePostResponse,
	CreateRepoRequest,
	DeleteCodemarkRequest,
	DeletePostRequest,
	DeletePostResponse,
	EditPostRequest,
	EditPostResponse,
	FetchCodemarksRequest,
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
	GetCodemarkRequest,
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
	UpdateStreamMembershipResponse
} from "../../protocol/agent.protocol";
import {
	CSCodemark,
	CSGetMeResponse,
	CSLoginResponse,
	CSMarker,
	CSMarkerLocations,
	CSMe,
	CSMSTeamsProviderInfo,
	CSPost,
	CSRepository,
	CSStream,
	CSUser,
	ProviderType,
	StreamType
} from "../../protocol/api.protocol";
import { debug, Functions, log } from "../../system";
import {
	ApiProvider,
	CodeStreamApiMiddleware,
	LoginOptions,
	MessageType,
	RTMessage
} from "../apiProvider";
import { CodeStreamApiProvider } from "../codestream/codestreamApi";
import { CodeStreamPreferences } from "../preferences";
// import { TeamsEvents } from "./events";
import {
	fromTeamsChannel,
	fromTeamsPost,
	fromTeamsPostId,
	fromTeamsUser,
	toTeamsPostBody,
	toTeamsTeam
} from "./teamsApi.adapters";
import { TeamsUnreads } from "./unreads";

export class MSTeamsApiProvider implements ApiProvider {
	private _onDidReceiveMessage = new Emitter<RTMessage>();
	get onDidReceiveMessage(): Event<RTMessage> {
		return this._onDidReceiveMessage.event;
	}

	private _teams: Client;
	// private _events: TeamsEvents | undefined;
	private readonly _codestreamUserId: string;
	private _providerInfo: CSMSTeamsProviderInfo;
	private readonly _teamsTeamId: string;
	private readonly _teamsUserId: string;

	private _preferences: CodeStreamPreferences;
	private readonly _unreads: TeamsUnreads;
	// TODO: Convert to index on UserManager?
	private _usernamesById: Map<string, string> | undefined;
	// TODO: Convert to index on UserManager?
	private _userIdsByName: Map<string, string> | undefined;

	readonly capabilities: Capabilities = {
		channelMute: false
	};

	constructor(
		private _codestream: CodeStreamApiProvider,
		providerInfo: CSMSTeamsProviderInfo,
		user: CSMe,
		private readonly _codestreamTeamId: string,
		private readonly _proxyAgent: HttpsProxyAgent | undefined
	) {
		this._providerInfo = providerInfo;
		this._teams = this.newClient();

		// this._teams.on("rate_limited", retryAfter => {
		// 	Logger.log(
		// 		`SlackApiProvider request was rate limited and future requests will be paused for ${retryAfter} seconds`
		// 	);
		// });

		this._unreads = new TeamsUnreads(this);
		this._unreads.onDidChange(this.onUnreadsChanged, this);

		this._preferences = new CodeStreamPreferences(user.preferences);

		this._codestreamUserId = user.id;
		this._teamsUserId = providerInfo.userId;
		this._teamsTeamId = providerInfo.teamId;
	}

	private _refreshPromise: Promise<CSMe> | undefined;
	private async getAccessToken() {
		// TODO: Fix this
		if (Date.now() >= this._providerInfo.expiresAt) {
			if (this._refreshPromise === undefined) {
				this._refreshPromise = this._codestream
					.refreshAuthProvider({
						providerId: "msteams",
						refreshToken: this._providerInfo.refreshToken
					})
					.then(me => {
						this._providerInfo = me.providerInfo![this._codestreamTeamId].msteams!;
						return me;
					});

				const me = await this._refreshPromise;
				this._refreshPromise = undefined;

				SessionContainer.instance().users.resolve({
					type: MessageType.Users,
					data: [me]
				});
			} else {
				void (await this._refreshPromise);
			}
		}

		return this._providerInfo.accessToken;
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
								void Container.instance().session.reset();
								// TODO: Handle reconnect to pubnub?
							}

							// if (!this._events!.connected) {
							// 	Logger.log(
							// 		`SlackApiProvider.onCodeStreamMessage(${
							// 			e.type
							// 		}); Slack RTM lost its connection, reconnecting...`
							// 	);
							// 	void Container.instance().session.reset(ResetReason.LostConnection);

							// 	void (await this._events!.reconnect());
							// }

							break;
					}
					break;

				case MessageType.Preferences: {
					this._preferences.update(e.data);
					break;
				}
				case MessageType.Users:
					// TODO: Map with slack data
					const user = e.data.find(u => u.id === this._codestreamUserId);
					if (user === undefined) return;

					// this.getMe() will update the user's cache so no need to do it here
					const meResponse = await this.getMe();
					this._onDidReceiveMessage.fire({ type: e.type, data: [meResponse.user] });
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

	async processLoginResponse(response: CSLoginResponse): Promise<void> {
		// Mix in slack user info with ours
		const meResponse = await this.getMeCore({ user: response.user });

		// TODO: Correlate codestream ids to slack ids once the server returns that info
		// const users = await this._codestream.fetchUsers({});
		// users;

		const team = response.teams.find(t => t.id === this._codestreamTeamId);
		if (team !== undefined) {
			toTeamsTeam(team, await this.ensureUsernamesById());
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

	async login(options: LoginOptions): Promise<CSLoginResponse & { teamId: string }> {
		throw new Error("Not supported");
	}

	@log()
	async subscribe(types?: MessageType[]) {
		// this._events = this.newTeamsEvents();
		// this._events.onDidReceiveMessage(e => {
		// 	if (e.type === MessageType.Preferences) {
		// 		this._preferences.update(e.data);
		// 	} else {
		// 		this._onDidReceiveMessage.fire(e);
		// 	}
		// });

		this._preferences.onDidChange(preferences => {
			this._onDidReceiveMessage.fire({ type: MessageType.Preferences, data: preferences });
		});

		this.getInitialPreferences().then(preferences => {
			this._preferences.update(preferences);
		});

		// const usernamesById = await this.ensureUsernamesById();
		// await this._events.connect([...usernamesById.keys()]);

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

	// protected newTeamsEvents() {
	// 	return new TeamsEvents(this._teamsToken, this, this._proxyAgent);
	// }

	async ensureUsernamesById(): Promise<Map<string, string>> {
		if (this._usernamesById === undefined) {
			void (await this.ensureUserMaps());
		}
		return this._usernamesById!;
	}

	private async ensureUserIdsByName(): Promise<Map<string, string>> {
		if (this._userIdsByName === undefined) {
			void (await this.ensureUserMaps());
		}

		return this._userIdsByName!;
	}

	private async ensureUserMaps(): Promise<void> {
		if (this._usernamesById === undefined || this._userIdsByName === undefined) {
			const users = (await SessionContainer.instance().users.get()).users;

			this._usernamesById = new Map();
			this._userIdsByName = new Map();

			for (const user of users) {
				this._usernamesById.set(user.id, user.username);
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

		const response = await this.teamsApiCall("me", request => request.get());

		const user = fromTeamsUser(response, this._codestreamTeamId);
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
	async createPost(request: CreatePostRequest): Promise<CreatePostResponse> {
		let createdPostId;
		try {
			const usernamesById = await this.ensureUsernamesById();
			const userIdsByName = await this.ensureUserIdsByName();

			let text = request.text;
			// let meMessage = meMessageRegex.test(text);
			// // If we are trying post a me message as a reply, send it as a normal reply with /me replaced with the username
			// if (meMessage && request.parentPostId != null) {
			// 	text = text.replace(meMessageRegex, `${usernamesById.get(this._slackUserId)} `);
			// 	meMessage = false;
			// }

			// if (text) {
			// 	text = toSlackPostText(text, request.mentionedUserIds, userIdsByName);
			// }

			const { streamId, postId: parentPostId } = fromTeamsPostId(
				request.parentPostId,
				request.streamId!
			);

			// if (meMessage) {
			// 	const response = await this.teamsApiCall(
			// 		this._teams.chat.meMessage,
			// 		{
			// 			channel: streamId,
			// 			text: text
			// 		},
			// 		`chat.meMessage`
			// 	);

			// 	const { ok, error, ts: postId } = response as WebAPICallResult & { ts?: any };
			// 	if (!ok) throw new Error(error);

			// 	const postResponse = await this.getPost({ streamId: streamId, postId: postId });
			// 	return postResponse;
			// }

			// let attachment: MessageAttachment | undefined;
			let body: { contentType: "text" | "html"; content: string };
			let codemark: CSCodemark | undefined;
			let markers: CSMarker[] | undefined;
			let markerLocations: CSMarkerLocations[] | undefined;
			let streams: CSStream[] | undefined;
			let repos: CSRepository[] | undefined;

			if (request.codemark != null) {
				if (!text) {
					text = request.codemark.text || request.codemark.title || "";
				}

				const codemarkResponse = await this.createCodemark({
					...request.codemark,
					parentPostId: request.parentPostId,
					providerType: ProviderType.MSTeams
				});

				({ codemark, markers, markerLocations, streams, repos } = codemarkResponse);

				body = toTeamsPostBody(
					codemark,
					request.codemark.remotes,
					markers,
					markerLocations,
					usernamesById,
					this._teamsUserId
				);

				// if (attachment.author_name) {
				// 	text = attachment.author_name;
				// 	attachment.author_name = undefined;

				// 	if (request.mentionedUserIds != null && request.mentionedUserIds.length !== 0) {
				// 		text += ` /cc ${request.mentionedUserIds
				// 			.map(u => `@${usernamesById.get(u)}`)
				// 			.join(", ")}`;
				// 	}
				// 	text = toSlackPostText(text, request.mentionedUserIds, userIdsByName);
				// }
			} else {
				body = { contentType: "text", content: text };
			}

			const response = await this.teamsApiCall<any>(
				`teams/${this._teamsTeamId}/channels/${streamId}/messages${
					parentPostId ? `/${parentPostId}/replies` : ""
				}`,
				request =>
					request.post({
						body: body
					})
			);

			const post = await fromTeamsPost(response, streamId, usernamesById, this._codestreamTeamId);
			const { postId } = fromTeamsPostId(post.id, post.streamId);
			createdPostId = postId;

			if (codemark) {
				await this._codestream.updateCodemark({
					codemarkId: codemark.id,
					streamId: post.streamId,
					postId: post.id
				});
				codemark.postId = post.id;
				codemark.streamId = post.streamId;
			}

			return {
				post: post,
				codemark,
				markers,
				markerLocations,
				streams,
				repos
			};
		} catch (ex) {
			throw ex;
		} finally {
			// if (createdPostId) {
			// 	this.updatePostsCount(this.teamId, request.streamId, createdPostId, request.parentPostId);
			// }
		}
	}

	private async updatePostsCount(
		teamId: string,
		streamId: string,
		postId: string,
		parentPostId?: string
	) {
		try {
			void (await this._codestream.trackSlackPost({ teamId, streamId, postId, parentPostId }));
		} catch (ex) {
			debugger;
			Logger.error(ex, "Failed updating post count");
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
		const { streamId, postId } = fromTeamsPostId(request.postId, request.streamId);

		const response = await this.teamsApiCall<{ value: any[] }>(
			`teams/${this._teamsTeamId}/channels/${streamId}/messages/${postId}/replies`,
			request => request.get()
		);

		// Ensure the correct ordering
		// messages.sort((a: any, b: any) => a.ts - b.ts);

		const usernamesById = await this.ensureUsernamesById();
		const posts = await Promise.all(response.value.map((m: any) =>
			fromTeamsPost(m, streamId, usernamesById, this._codestreamTeamId)
		) as Promise<CSPost>[]);

		return { posts: posts };
	}

	@log()
	async fetchPosts(request: FetchPostsRequest): Promise<FetchPostsResponse> {
		return { posts: [], more: false };
	}

	@log()
	async getPost(request: GetPostRequest): Promise<GetPostResponse> {
		const { streamId, postId } = fromTeamsPostId(request.postId, request.streamId);

		const response = await this.teamsApiCall<any>(
			`teams/${this._teamsTeamId}/channels/${streamId}/messages/${postId}`,
			request => request.get()
		);

		const usernamesById = await this.ensureUsernamesById();
		const post = await fromTeamsPost(response, streamId, usernamesById, this._codestreamTeamId);

		return { post: post };
	}

	@log()
	async getPosts(request: GetPostsRequest): Promise<GetPostsResponse> {
		const responses = await Promise.all(
			request.postIds.map(id => this.getPost({ streamId: request.streamId, postId: id }))
		);
		const posts: CSPost[] = [];
		responses.forEach(p => posts.push(p.post));
		return { posts };
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
			const response = await this.teamsApiCall<{ value: any[] }>(
				`teams/${this._teamsTeamId}/channels`,
				request => request.get()
			);

			const streams = response.value.map(c =>
				fromTeamsChannel(c, this._teamsUserId, this._codestreamTeamId)
			);

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

		throw new Error("Not Supported");

		// let stream;
		// switch (fromSlackChannelIdToType(request.streamId)) {
		// 	case "channel":
		// 		stream = await this.fetchChannel(request.streamId);
		// 		break;
		// 	case "group":
		// 		stream = await this.fetchGroup(request.streamId, await this.ensureUsernamesById());
		// 		break;
		// 	case "direct":
		// 		stream = await this.fetchIM(request.streamId, await this.ensureUsernamesById());
		// 		break;
		// 	default:
		// 		throw new Error(`Invalid stream type: ${request.streamId}`);
		// }

		// return { stream: stream };
	}

	// @log()
	// private async getStreamMembers(streamId: string) {
	// 	const response = await this.teamsApiCall(
	// 		this._teams.conversations.members,
	// 		{
	// 			channel: streamId
	// 			// limit: 1000
	// 		},
	// 		`conversations.members`
	// 	);

	// 	const { ok, error, members } = response as WebAPICallResult & { members: string[] };
	// 	if (!ok) throw new Error(error);

	// 	return members;
	// }

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
			toTeamsTeam(team, await this.ensureUsernamesById());
		}

		return response;
	}

	@log()
	async getTeam(request: GetTeamRequest) {
		const response = await this._codestream.getTeam(request);

		// Replace the current team's ids with slack ids
		if (response.team != null && response.team.id === this._codestreamTeamId) {
			toTeamsTeam(response.team, await this.ensureUsernamesById());
		}

		return response;
	}

	@log()
	async fetchUsers(request: FetchUsersRequest): Promise<FetchUsersResponse> {
		const response = await this.teamsApiCall<{ value: any[] }>(
			`groups/${this._teamsTeamId}/members`,
			request => request.get()
		);

		const { team } = await this._codestream.getTeam({ teamId: this._codestreamTeamId });
		const { users: codestreamMembers } = await this._codestream.fetchUsers({
			userIds: team.memberIds
		});

		const users: CSUser[] = response.value
			.map((m: any) => fromTeamsUser(m, this._codestreamTeamId, codestreamMembers))
			.filter(u => !u.deactivated);

		// Find ourselves and replace it with our model
		const index = users.findIndex(u => u.id === this._teamsUserId);

		const meResponse = await this.getMeCore();
		users.splice(index, 1, meResponse.user);

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

		const response = await this.teamsApiCall(`users/${request.userId}`, request => request.get());
		const user = fromTeamsUser(response, this._codestreamTeamId);

		return { user: user };
	}

	@log()
	inviteUser(request: InviteUserRequest) {
		return this._codestream.inviteUser(request);
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
	disconnectThirdPartyProvider(request: { providerId: string }) {
		return this._codestream.disconnectThirdPartyProvider(request);
	}

	@log()
	refreshThirdPartyProvider(request: { providerId: string; refreshToken: string }): Promise<CSMe> {
		return this._codestream.refreshThirdPartyProvider(request);
	}

	@debug<MSTeamsApiProvider, MSTeamsApiProvider["teamsApiCall"]>({
		args: false,
		prefix: (context, path, fn) => `${context.prefix} ${path}`
	})
	protected async teamsApiCall<TResponse>(
		path: string,
		fn: (request: GraphRequest) => Promise<TResponse>
	): Promise<TResponse> {
		const cc = Logger.getCorrelationContext();

		const timeoutMs = 30000;
		try {
			const response = await Functions.cancellable(
				fn(this._teams.api(`https://graph.microsoft.com/beta/${path}`)),
				timeoutMs,
				{
					onDidCancel: (resolve, reject) => Logger.warn(cc, `TIMEOUT ${timeoutMs / 1000}s exceeded`)
				}
			);

			// if (Container.instance().session.recordRequests) {
			// 	const now = Date.now();
			// 	// const { method, body } = init;

			// 	const fs = require("fs");
			// 	const sanitize = require("sanitize-filename");
			// 	const sanitizedMethod = sanitize(
			// 		path
			// 		// .split("?")[0]
			// 		// .replace(/\//g, "_")
			// 		// .replace("_", "")
			// 	);
			// 	const filename = `/tmp/dump-${now}-slack-${sanitizedMethod}.json`;

			// 	const out = {
			// 		url: path,
			// 		request: request,
			// 		response: response
			// 	};
			// 	const outString = JSON.stringify(out, null, 2);

			// 	fs.writeFile(filename, outString, "utf8", () => {
			// 		Logger.log(`Written ${filename}`);
			// 	});
			// }

			return response as TResponse;
		} catch (ex) {
			Logger.error(ex, cc, ex.data != null ? JSON.stringify(ex.data) : undefined);
			throw ex;
		}
	}

	async dispose() {
		await this._codestream.dispose();
		// if (this._events) {
		// 	await this._events.dispose();
		// }
	}
}

// const logFilterKeys = new Set(["text", "attachments"]);
