"use strict";
import HttpsProxyAgent from "https-proxy-agent";
import { cloneDeep, isEqual } from "lodash-es";
import fetch, { Headers, RequestInit, Response } from "node-fetch";
import { URLSearchParams } from "url";
import { Emitter, Event } from "vscode-languageserver";
import { ServerError } from "../../agentError";
import { Team, User } from "../../api/extensions";
import { Container, SessionContainer } from "../../container";
import { Logger } from "../../logger";
import { isDirective, resolve } from "../../managers/operations";
import {
	AccessToken,
	AddEnterpriseProviderHostRequest,
	AddEnterpriseProviderHostResponse,
	ArchiveStreamRequest,
	Capabilities,
	CloseStreamRequest,
	CreateChannelStreamRequest,
	CreateCodemarkPermalinkRequest,
	CreateCodemarkRequest,
	CreateDirectStreamRequest,
	CreateMarkerLocationRequest,
	CreatePostRequest,
	CreateRepoRequest,
	CreateTeamRequest,
	CreateTeamRequestType,
	DeleteCodemarkRequest,
	DeletePostRequest,
	EditPostRequest,
	FetchCodemarksRequest,
	FetchFileStreamsRequest,
	FetchMarkerLocationsRequest,
	FetchMarkersRequest,
	FetchPostRepliesRequest,
	FetchPostsRequest,
	FetchStreamsRequest,
	FetchTeamsRequest,
	FetchUnreadStreamsRequest,
	FetchUsersRequest,
	GetCodemarkRequest,
	GetMarkerRequest,
	GetPostRequest,
	GetPostsRequest,
	GetRepoRequest,
	GetStreamRequest,
	GetTeamRequest,
	GetUnreadsRequest,
	GetUserRequest,
	InviteUserRequest,
	JoinStreamRequest,
	LeaveStreamRequest,
	MarkPostUnreadRequest,
	MarkStreamReadRequest,
	MuteStreamRequest,
	OpenStreamRequest,
	PinReplyToCodemarkRequest,
	ReactToPostRequest,
	RenameStreamRequest,
	SendPasswordResetEmailRequest,
	SendPasswordResetEmailRequestType,
	SetCodemarkPinnedRequest,
	SetCodemarkStatusRequest,
	SetStreamPurposeRequest,
	ThirdPartyProviderSetTokenRequest,
	ThirdPartyProviderSetTokenRequestData,
	UnarchiveStreamRequest,
	Unreads,
	UpdateCodemarkRequest,
	UpdateMarkerRequest,
	UpdatePreferencesRequest,
	UpdatePresenceRequest,
	UpdateStreamMembershipRequest
} from "../../protocol/agent.protocol";
import {
	CSAddProviderHostRequest,
	CSAddProviderHostResponse,
	CSChannelStream,
	CSCompleteSignupRequest,
	CSConfirmRegistrationRequest,
	CSCreateChannelStreamRequest,
	CSCreateChannelStreamResponse,
	CSCreateCodemarkPermalinkRequest,
	CSCreateCodemarkPermalinkResponse,
	CSCreateCodemarkRequest,
	CSCreateCodemarkResponse,
	CSCreateDirectStreamRequest,
	CSCreateDirectStreamResponse,
	CSCreateMarkerLocationRequest,
	CSCreateMarkerLocationResponse,
	CSCreatePostRequest,
	CSCreatePostResponse,
	CSCreateRepoRequest,
	CSCreateRepoResponse,
	CSDeleteCodemarkResponse,
	CSDeletePostResponse,
	CSDirectStream,
	CSEditPostRequest,
	CSEditPostResponse,
	CSFileStream,
	CSGetCodemarkResponse,
	CSGetCodemarksResponse,
	CSGetInviteInfoRequest,
	CSGetInviteInfoResponse,
	CSGetMarkerLocationsResponse,
	CSGetMarkerResponse,
	CSGetMarkersResponse,
	CSGetMeResponse,
	CSGetPostResponse,
	CSGetPostsResponse,
	CSGetRepoResponse,
	CSGetReposResponse,
	CSGetStreamResponse,
	CSGetStreamsResponse,
	CSGetTeamResponse,
	CSGetTeamsResponse,
	CSGetTelemetryKeyResponse,
	CSGetUserResponse,
	CSGetUsersResponse,
	CSInviteUserRequest,
	CSInviteUserResponse,
	CSJoinStreamRequest,
	CSJoinStreamResponse,
	CSLoginRequest,
	CSLoginResponse,
	CSMarkPostUnreadRequest,
	CSMarkPostUnreadResponse,
	CSMe,
	CSMePreferences,
	CSPinReplyToCodemarkRequest,
	CSPinReplyToCodemarkResponse,
	CSPost,
	CSReactions,
	CSReactToPostResponse,
	CSRefreshableProviderInfos,
	CSRegisterRequest,
	CSRegisterResponse,
	CSSetCodemarkPinnedRequest,
	CSSetCodemarkPinnedResponse,
	CSStream,
	CSTeam,
	CSTrackProviderPostRequest,
	CSUpdateCodemarkRequest,
	CSUpdateCodemarkResponse,
	CSUpdateMarkerRequest,
	CSUpdateMarkerResponse,
	CSUpdatePresenceRequest,
	CSUpdatePresenceResponse,
	CSUpdateStreamRequest,
	CSUpdateStreamResponse,
	LoginResult,
	StreamType
} from "../../protocol/api.protocol";
import { VersionInfo } from "../../session";
import { Functions, getProvider, log, lsp, lspHandler, Objects, Strings } from "../../system";
import { openUrl } from "../../system/openUrl";
import {
	ApiProvider,
	ApiProviderLoginResponse,
	CodeStreamApiMiddleware,
	CodeStreamApiMiddlewareContext,
	LoginOptions,
	MessageType,
	RawRTMessage,
	RTMessage
} from "../apiProvider";
import { CodeStreamPreferences } from "../preferences";
import { BroadcasterEvents } from "./events";
import { CodeStreamUnreads } from "./unreads";

@lsp
export class CodeStreamApiProvider implements ApiProvider {
	private _onDidReceiveMessage = new Emitter<RTMessage>();
	get onDidReceiveMessage(): Event<RTMessage> {
		return this._onDidReceiveMessage.event;
	}

	private _onDidSubscribe = new Emitter<void>();
	get onDidSubscribe(): Event<void> {
		return this._onDidSubscribe.event;
	}
	private _subscribePromise = new Promise<void>(resolve => {
		this.onDidSubscribe(resolve);
	});

	private _events: BroadcasterEvents | undefined;
	private readonly _middleware: CodeStreamApiMiddleware[] = [];
	private _pubnubSubscribeKey: string | undefined;
	private _broadcasterToken: string | undefined;
	private _socketCluster: { host: string; port: string } | undefined;
	private _subscribedMessageTypes: Set<MessageType> | undefined;
	private _teamId: string | undefined;
	private _token: string | undefined;
	private _unreads: CodeStreamUnreads | undefined;
	private _user: CSMe | undefined;
	private _userId: string | undefined;
	private _preferences: CodeStreamPreferences | undefined;

	readonly capabilities: Capabilities = {
		channelMute: true,
		postDelete: true,
		postEdit: true,
		providerCanSupportRealtimeChat: true,
		providerSupportsRealtimeChat: true,
		providerSupportsRealtimeEvents: true
	};

	constructor(
		public readonly baseUrl: string,
		private readonly _version: VersionInfo,
		private readonly _proxyAgent: HttpsProxyAgent | undefined
	) {}

	get teamId(): string {
		return this._teamId!;
	}

	get userId(): string {
		return this._userId!;
	}

	useMiddleware(middleware: CodeStreamApiMiddleware) {
		this._middleware.push(middleware);
		return {
			dispose: () => {
				const i = this._middleware.indexOf(middleware);
				this._middleware.splice(i, 1);
			}
		};
	}

	async dispose() {
		if (this._events) {
			await this._events.dispose();
		}
	}

	async login(options: LoginOptions): Promise<ApiProviderLoginResponse> {
		let response;
		switch (options.type) {
			case "credentials":
				response = await this.put<CSLoginRequest, CSLoginResponse>("/no-auth/login", {
					email: options.email,
					password: options.password
				});
				// Set the provider to be codestream since that is all that is supported for email/password login
				response.provider = "codestream";

				break;

			case "otc":
				response = await this.put<CSCompleteSignupRequest, CSLoginResponse>(
					"/no-auth/check-signup",
					{
						token: options.code
					}
				);

				break;

			case "token":
				if (options.token.url !== this.baseUrl) throw new Error("Invalid token");

				response = await this.put<{}, CSLoginResponse>("/login", {}, options.token.value);

				response.provider = options.token.provider;
				response.providerAccess = options.token.providerAccess;
				response.teamId = options.token.teamId;

				break;
			default:
				throw new Error("Invalid login options");
		}

		const provider = response.provider;

		Logger.log(
			`CodeStream user '${response.user.username}' (${
				response.user.id
			}) is logging into ${provider || "uknown"}${
				response.providerAccess ? `:${response.providerAccess}` : ""
			} and belongs to ${response.teams.length} team(s)\n${response.teams
				.map(t => `\t${t.name} (${t.id})`)
				.join("\n")}`
		);

		if (response.teams.length === 0) {
			// save the accessToken for the call to create a team
			this._token = response.accessToken;
			// 💩: the session/webview need the accessToken token
			throw { status: LoginResult.NotOnTeam, token: response.accessToken };
		}

		let pickedTeamReason;
		let team: CSTeam | undefined;
		let teams = response.teams;

		// If we are a slack/msteams team or have no overrides, then use the response teamId directly
		if (
			provider != null &&
			(provider !== "codestream" ||
				(options.team == null && (options.teamId == null || options.teamId === response.teamId)))
		) {
			const teamId = response.teamId;
			team = teams.find(t => t.id === teamId);

			if (team != null) {
				pickedTeamReason = " because the team was associated with the authentication token";
			} else {
				// If we can't find the team, make sure to filter to only teams that match the current provider
				teams = response.teams.filter(t => Team.isProvider(t, provider));
			}
		}

		if (team == null) {
			// If there is only 1 team, use it regardless of config
			if (teams.length === 1) {
				options.teamId = teams[0].id;
			} else {
				// Sort the teams from oldest to newest
				teams.sort((a, b) => a.createdAt - b.createdAt);
			}

			if (options.teamId == null) {
				if (options.team) {
					const normalizedTeamName = options.team.toLocaleUpperCase();
					const team = teams.find(t => t.name.toLocaleUpperCase() === normalizedTeamName);
					if (team != null) {
						options.teamId = team.id;
						pickedTeamReason =
							" because the team was saved in settings (user, workspace, or folder)";
					}
				}

				// If we still can't find a team, then just pick the first one
				if (options.teamId == null) {
					// Pick the oldest (first) Slack team if there is one
					if (User.isSlack(response.user)) {
						const team = teams.find(t => Team.isSlack(t));
						if (team) {
							options.teamId = team.id;
							pickedTeamReason = " because the team was the oldest Slack team";
						}
					}

					// Pick the oldest (first) MS Teams team if there is one
					if (options.teamId == null && User.isMSTeams(response.user)) {
						const team = teams.find(t => Team.isMSTeams(t));
						if (team) {
							options.teamId = team.id;
							pickedTeamReason = " because the team was the oldest Microsoft Teams team";
						}
					}

					if (options.teamId == null) {
						options.teamId = teams[0].id;
						pickedTeamReason = " because the team was the oldest team";
					}
				}
			} else {
				pickedTeamReason = " because the team was the last used team";
			}

			team = teams.find(t => t.id === options.teamId);
			if (team === undefined) {
				team = teams[0];
				pickedTeamReason =
					" because the specified team could not be found, defaulting to the oldest team";
			}
		}

		Logger.log(`Using team '${team.name}' (${team.id})${pickedTeamReason || ""}`);

		this._token = response.accessToken;
		this._pubnubSubscribeKey = response.pubnubKey;
		this._broadcasterToken = response.broadcasterToken || response.pubnubToken;
		this._socketCluster = response.socketCluster;

		this._teamId = team.id;
		this._user = response.user;
		this._userId = response.user.id;

		const token: AccessToken = {
			email: response.user.email,
			url: this.baseUrl,
			value: response.accessToken,
			provider: response.provider,
			providerAccess: response.providerAccess,
			teamId: team.id
		};

		return { ...response, token: token };
	}

	register(request: CSRegisterRequest) {
		return this.post<CSRegisterRequest, CSRegisterResponse | CSLoginResponse>(
			"/no-auth/register",
			request
		);
	}

	async confirmRegistration(request: CSConfirmRegistrationRequest): Promise<CSLoginResponse> {
		const response = await this.post<CSConfirmRegistrationRequest, CSLoginResponse>(
			"/no-auth/confirm",
			request
		);
		this._token = response.accessToken;
		return response;
	}

	getInviteInfo(request: CSGetInviteInfoRequest) {
		return this.get<CSGetInviteInfoResponse>(`/no-auth/invite-info?code=${request.code}`);
	}

	@log()
	async subscribe(types?: MessageType[]) {
		this._subscribedMessageTypes = types !== undefined ? new Set(types) : undefined;

		if (types === undefined || types.includes(MessageType.Unreads)) {
			this._unreads = new CodeStreamUnreads(this);
			this._unreads.onDidChange(this.onUnreadsChanged, this);
			this._unreads.compute(this._user!.lastReads);
		}
		if (types === undefined || types.includes(MessageType.Preferences)) {
			this._preferences = new CodeStreamPreferences(this._user!.preferences);
			this._preferences.onDidChange(preferences => {
				this._onDidReceiveMessage.fire({ type: MessageType.Preferences, data: preferences });
			});
		}

		this._events = new BroadcasterEvents({
			accessToken: this._token!,
			pubnubSubscribeKey: this._pubnubSubscribeKey,
			broadcasterToken: this._broadcasterToken!,
			api: this,
			proxyAgent: this._proxyAgent,
			socketCluster: this._socketCluster
		});
		this._events.onDidReceiveMessage(this.onPubnubMessageReceived, this);

		if (types === undefined || types.includes(MessageType.Streams)) {
			const streams = (await SessionContainer.instance().streams.getSubscribable()).streams;
			await this._events.connect(streams.map(s => s.id));
		} else {
			await this._events.connect();
		}

		this._onDidSubscribe.fire();
	}

	private async onPubnubMessageReceived(e: RawRTMessage) {
		if (this._subscribedMessageTypes !== undefined && !this._subscribedMessageTypes.has(e.type)) {
			return;
		}

		// Resolve any directives in the message data
		switch (e.type) {
			case MessageType.Codemarks:
				e.data = await SessionContainer.instance().codemarks.resolve(e);
				break;
			case MessageType.MarkerLocations:
				e.data = await SessionContainer.instance().markerLocations.resolve(e);
				break;
			case MessageType.Markers:
				e.data = await SessionContainer.instance().markers.resolve(e);
				break;
			case MessageType.Posts:
				e.data = await SessionContainer.instance().posts.resolve(e);

				if (this._unreads !== undefined) {
					this._unreads.update(e.data as CSPost[]);
				}
				break;
			case MessageType.Repositories:
				e.data = await SessionContainer.instance().repos.resolve(e);
				break;
			case MessageType.Streams:
				e.data = await SessionContainer.instance().streams.resolve(e);

				if (this._events !== undefined) {
					for (const stream of e.data as (CSChannelStream | CSDirectStream)[]) {
						if (CodeStreamApiProvider.isStreamSubscriptionRequired(stream, this.userId)) {
							this._events.subscribeToStream(stream.id);
						} else if (CodeStreamApiProvider.isStreamUnsubscribeRequired(stream, this.userId)) {
							this._events.unsubscribeFromStream(stream.id);
						}
					}
				}

				break;
			case MessageType.Teams:
				const currentTeam = await SessionContainer.instance().teams.getByIdFromCache(this.teamId);
				const providerHostsBefore = cloneDeep((currentTeam ? currentTeam.providerHosts : undefined) || {});
				e.data = await SessionContainer.instance().teams.resolve(e);
				const providerHostsAfter = (currentTeam ? currentTeam.providerHosts : undefined) || {};
				if (!isEqual(providerHostsBefore, providerHostsAfter)) {
					SessionContainer.instance().session.updateProviders();
				}
				break;
			case MessageType.Users:
				const lastReads = {
					...(this._unreads ? (await this._unreads.get()).lastReads : this._user!.lastReads)
				};
				e.data = await SessionContainer.instance().users.resolve(e);

				const me = (e.data as CSMe[]).find(u => u.id === this.userId);
				if (me != null) {
					this._user = (await SessionContainer.instance().users.getMe()).user;

					try {
						if (
							this._unreads !== undefined &&
							(Objects.isEmpty(me.lastReads) ||
								!Objects.shallowEquals(lastReads, this._user.lastReads))
						) {
							this._unreads.compute(me.lastReads);
						}
						if (this._preferences && me.preferences && this._user.preferences) {
							this._preferences.update(this._user.preferences);
						}
					} catch {
						debugger;
					}
				}

				break;
		}

		this._onDidReceiveMessage.fire(e as RTMessage);
	}

	private onUnreadsChanged(e: Unreads) {
		this._onDidReceiveMessage.fire({ type: MessageType.Unreads, data: e });
	}

	grantBroadcasterChannelAccess(token: string, channel: string): Promise<{}> {
		return this.put(`/grant/${channel}`, {}, token);
	}

	@log()
	getMe() {
		return this.get<CSGetMeResponse>("/users/me", this._token);
	}

	@log()
	async getUnreads(request: GetUnreadsRequest) {
		if (this._unreads === undefined) {
			return {
				unreads: {
					lastReads: {},
					mentions: {},
					unreads: {},
					totalMentions: 0,
					totalUnreads: 0
				}
			};
		}

		return { unreads: await this._unreads!.get() };
	}

	@log()
	async trackProviderPost(request: CSTrackProviderPostRequest) {
		try {
			return await this.post(`/provider-posts/${request.provider}`, request, this._token);
		} catch (ex) {
			debugger;
			Logger.error(ex, `Failed updating ${request.provider} post count`);
			return undefined;
		}
	}

	@log()
	async updatePreferences(request: UpdatePreferencesRequest) {
		const update = await this.put<CSMePreferences, any>(
			"/preferences",
			request.preferences,
			this._token
		);
		const [user] = (await SessionContainer.instance().users.resolve({
			type: MessageType.Users,
			data: [update.user]
		})) as CSMe[];
		return { preferences: user.preferences || {} };
	}

	@log()
	updatePresence(request: UpdatePresenceRequest) {
		return this.put<CSUpdatePresenceRequest, CSUpdatePresenceResponse>(
			`/presence`,
			request,
			this._token
		);
	}

	// async createFileStream(relativePath: string, repoId: string) {
	// 	return this.createStream<CSCreateFileStreamRequest, CSCreateFileStreamResponse>({
	// 		teamId: this._teamId,
	// 		type: StreamType.File,
	// 		repoId: repoId,
	// 		file: relativePath
	// 	});
	// }

	@log()
	async fetchFileStreams(request: FetchFileStreamsRequest) {
		return this.get<CSGetStreamsResponse<CSFileStream>>(
			`/streams?teamId=${this.teamId}&repoId=${request.repoId}`,
			this._token
		);
	}

	@log()
	createMarkerLocation(request: CreateMarkerLocationRequest) {
		return this.put<CSCreateMarkerLocationRequest, CSCreateMarkerLocationResponse>(
			`/marker-locations`,
			{ ...request, teamId: this.teamId },
			this._token
		);
	}

	@log()
	fetchMarkerLocations(request: FetchMarkerLocationsRequest) {
		return this.get<CSGetMarkerLocationsResponse>(
			`/marker-locations?teamId=${this.teamId}&streamId=${request.streamId}&commitHash=${request.commitHash}`,
			this._token
		);
	}

	@log()
	fetchMarkers(request: FetchMarkersRequest) {
		// TODO: This doesn't handle all the request params
		return this.get<CSGetMarkersResponse>(
			`/markers?teamId=${this.teamId}&streamId=${request.streamId}${
				request.commitHash ? `&commitHash=${request.commitHash}` : ""
			}`,
			this._token
		);
	}

	@log()
	getMarker(request: GetMarkerRequest) {
		return this.get<CSGetMarkerResponse>(`/markers/${request.markerId}`, this._token);
	}

	@log()
	updateMarker(request: UpdateMarkerRequest) {
		return this.put<CSUpdateMarkerRequest, CSUpdateMarkerResponse>(
			`/markers/${request.markerId}`,
			request,
			this._token
		);
	}

	@log()
	createCodemark(request: CreateCodemarkRequest) {
		return this.post<CSCreateCodemarkRequest, CSCreateCodemarkResponse>(
			"/codemarks",
			{ ...request, teamId: this.teamId },
			this._token
		);
	}

	@log()
	deleteCodemark(request: DeleteCodemarkRequest) {
		const { codemarkId } = request;
		return this.delete<CSDeleteCodemarkResponse>(`/codemarks/${codemarkId}`, this._token);
	}

	@log()
	fetchCodemarks(request: FetchCodemarksRequest) {
		return this.get<CSGetCodemarksResponse>(`/codemarks?teamId=${this.teamId}`, this._token);
	}

	@log()
	getCodemark(request: GetCodemarkRequest) {
		return this.get<CSGetCodemarkResponse>(`/codemarks/${request.codemarkId}`, this._token);
	}

	@log()
	setCodemarkPinned(request: SetCodemarkPinnedRequest) {
		return this.put<CSSetCodemarkPinnedRequest, CSSetCodemarkPinnedResponse>(
			`${request.value ? "/pin" : "/unpin"}/${request.codemarkId}`,
			request,
			this._token
		);
	}

	@log()
	pinReplyToCodemark(request: PinReplyToCodemarkRequest) {
		return this.put<CSPinReplyToCodemarkRequest, CSPinReplyToCodemarkResponse>(
			request.value ? "/pin-post" : "/unpin-post",
			request,
			this._token
		);
	}

	@log()
	setCodemarkStatus(request: SetCodemarkStatusRequest) {
		return this.updateCodemark(request);
	}

	@log()
	updateCodemark(request: UpdateCodemarkRequest) {
		const { codemarkId, ...attributes } = request;
		return this.put<CSUpdateCodemarkRequest, CSUpdateCodemarkResponse>(
			`/codemarks/${codemarkId}`,
			attributes,
			this._token
		);
	}

	@log()
	createCodemarkPermalink(request: CreateCodemarkPermalinkRequest) {
		return this.post<CSCreateCodemarkPermalinkRequest, CSCreateCodemarkPermalinkResponse>(
			`/codemarks/${request.codemarkId}/permalink`,
			{ isPublic: request.isPublic },
			this._token
		);
	}

	@log()
	createPost(request: CreatePostRequest) {
		return this.post<CSCreatePostRequest, CSCreatePostResponse>(
			`/posts`,
			{ ...request, teamId: this.teamId },
			this._token
		);
	}

	@log()
	async deletePost(request: DeletePostRequest) {
		const response = await this.delete<CSDeletePostResponse>(
			`/posts/${request.postId}`,
			this._token
		);
		const [post] = await SessionContainer.instance().posts.resolve({
			type: MessageType.Posts,
			data: response.posts
		});
		await SessionContainer.instance().codemarks.resolve({
			type: MessageType.Codemarks,
			data: response.codemarks || []
		});
		await SessionContainer.instance().markers.resolve({
			type: MessageType.Markers,
			data: response.markers || []
		});

		return { ...response, post };
	}

	@log()
	async editPost(request: EditPostRequest) {
		const response = await this.put<CSEditPostRequest, CSEditPostResponse>(
			`/posts/${request.postId}`,
			request,
			this._token
		);
		const [post] = await SessionContainer.instance().posts.resolve({
			type: MessageType.Streams,
			data: [response.post]
		});
		return { ...response, post };
	}

	@log()
	fetchPostReplies(request: FetchPostRepliesRequest) {
		return this.get<CSGetPostsResponse>(
			`/posts?teamId=${this.teamId}&streamId=${request.streamId}&parentPostId=${request.postId}`,
			this._token
		);
	}

	@log()
	async fetchPosts(request: FetchPostsRequest) {
		if (!request.limit || request.limit > 100) {
			request.limit = 100;
		}

		let params = `&limit=${request.limit}`;
		if (request.before) {
			params += `&before=${request.before}`;
		}
		if (request.after) {
			params += `&after=${request.after}`;
		}
		if (request.inclusive === true) {
			params += `&inclusive`;
		}

		const response = await this.get<CSGetPostsResponse>(
			`/posts?teamId=${this.teamId}&streamId=${request.streamId}${params}`,
			this._token
		);

		if (response.posts) {
			response.posts.sort((a: CSPost, b: CSPost) => (a.seqNum as number) - (b.seqNum as number));
		}

		return response;
	}

	@log()
	getPost(request: GetPostRequest) {
		return this.get<CSGetPostResponse>(
			`/posts/${request.postId}?teamId=${this.teamId}`,
			this._token
		);
	}

	@log()
	getPosts(request: GetPostsRequest) {
		return this.get<CSGetPostsResponse>(
			`/posts?teamId=${this.teamId}&streamId=${request.streamId}&postIds=${request.postIds.join(
				","
			)}`,
			this._token
		);
	}

	@log()
	markPostUnread(request: MarkPostUnreadRequest) {
		return this.put<CSMarkPostUnreadRequest, CSMarkPostUnreadResponse>(
			`/unread/${request.postId}`,
			request,
			this._token
		);
	}

	@log()
	async reactToPost(request: ReactToPostRequest) {
		const response = await this.put<CSReactions, CSReactToPostResponse>(
			`/react/${request.postId}`,
			request.emojis,
			this._token
		);

		const [post] = await SessionContainer.instance().posts.resolve({
			type: MessageType.Posts,
			data: [response.post]
		});
		return { ...response, post: post };
	}

	@log()
	createRepo(request: CreateRepoRequest) {
		return this.post<CSCreateRepoRequest, CSCreateRepoResponse>(
			`/repos`,
			{ ...request, teamId: this.teamId },
			this._token
		);
	}

	@log()
	fetchRepos() {
		return this.get<CSGetReposResponse>(`/repos?teamId=${this.teamId}`, this._token);
	}

	@log()
	getRepo(request: GetRepoRequest) {
		return this.get<CSGetRepoResponse>(`/repos/${request.repoId}`, this._token);
	}

	@log()
	createChannelStream(request: CreateChannelStreamRequest) {
		return this.post<CSCreateChannelStreamRequest, CSCreateChannelStreamResponse>(
			`/streams`,
			{ ...request, teamId: this.teamId },
			this._token
		);
	}

	@log()
	createDirectStream(request: CreateDirectStreamRequest) {
		return this.post<CSCreateDirectStreamRequest, CSCreateDirectStreamResponse>(
			`/streams`,
			{ ...request, teamId: this.teamId },
			this._token
		);
	}

	@log()
	fetchStreams(request: FetchStreamsRequest) {
		if (
			request.types == null ||
			request.types.length === 0 ||
			(request.types.includes(StreamType.Channel) && request.types.includes(StreamType.Direct))
		) {
			return this.get<CSGetStreamsResponse<CSChannelStream | CSDirectStream>>(
				`/streams?teamId=${this.teamId}`,
				this._token
			);
		}

		return this.get<CSGetStreamsResponse<CSChannelStream | CSDirectStream>>(
			`/streams?teamId=${this.teamId}&type=${request.types[0]}`,
			this._token
		);
	}

	@log()
	fetchUnreadStreams(request: FetchUnreadStreamsRequest) {
		return this.get<CSGetStreamsResponse<CSChannelStream | CSDirectStream>>(
			`/streams?teamId=${this.teamId}&unread`,
			this._token
		);
	}

	@log()
	async getStream(request: GetStreamRequest) {
		return this.get<CSGetStreamResponse<CSChannelStream | CSDirectStream>>(
			`/streams/${request.streamId}`,
			this._token
		);
	}

	@log()
	async archiveStream(request: ArchiveStreamRequest) {
		return this.updateStream<CSChannelStream>(request.streamId, { isArchived: true });
	}

	@log()
	closeStream(request: CloseStreamRequest) {
		return this.updateStream<CSDirectStream>(request.streamId, { isClosed: true });
	}

	@log()
	async joinStream(request: JoinStreamRequest) {
		const response = await this.put<CSJoinStreamRequest, CSJoinStreamResponse>(
			`/join/${request.streamId}`,
			{},
			this._token
		);

		const [stream] = await SessionContainer.instance().streams.resolve({
			type: MessageType.Streams,
			data: [response.stream]
		});

		return { stream: stream as CSChannelStream };
	}

	@log()
	async leaveStream(request: LeaveStreamRequest) {
		// Get a copy of the original stream & copy its membership array (since it will be mutated)
		const originalStream = {
			...(await SessionContainer.instance().streams.getById(request.streamId))
		};
		if (originalStream.memberIds != null) {
			originalStream.memberIds = originalStream.memberIds.slice(0);
		}

		if (this._events !== undefined) {
			this._events.unsubscribeFromStream(request.streamId);
		}

		try {
			const response = await this.updateStream(request.streamId, {
				$pull: { memberIds: [this._userId] }
			});
			return { stream: response.stream as CSChannelStream };
		} catch (ex) {
			Logger.error(ex);

			// Since this can happen because we have no permission to the stream anymore,
			// simulate removing ourselves from the membership list
			if (originalStream.memberIds != null) {
				const index = originalStream.memberIds.findIndex(m => m === this._userId);
				if (index !== -1) {
					originalStream.memberIds.splice(index, 1);
				}
			}
			return { stream: originalStream as CSChannelStream };
		}
	}

	@log()
	markStreamRead(request: MarkStreamReadRequest) {
		return this.put(`/read/${request.streamId}`, {}, this._token);
	}

	@log()
	async muteStream(request: MuteStreamRequest) {
		void (await this.updatePreferences({
			preferences: {
				$set: { [`mutedStreams.${request.streamId}`]: request.mute }
			}
		}));

		const stream = await SessionContainer.instance().streams.getById(request.streamId);
		return { stream: stream };
	}

	@log()
	openStream(request: OpenStreamRequest) {
		return this.updateStream<CSDirectStream>(request.streamId, { isClosed: false });
	}

	@log()
	renameStream(request: RenameStreamRequest) {
		return this.updateStream<CSChannelStream>(request.streamId, { name: request.name });
	}

	@log()
	setStreamPurpose(request: SetStreamPurposeRequest) {
		return this.updateStream<CSChannelStream>(request.streamId, { purpose: request.purpose });
	}

	@log()
	unarchiveStream(request: UnarchiveStreamRequest) {
		return this.updateStream<CSChannelStream>(request.streamId, { isArchived: false });
	}

	private async updateStream<T extends CSChannelStream | CSDirectStream>(
		streamId: string,
		changes: { [key: string]: any }
	) {
		const response = await this.put<CSUpdateStreamRequest, CSUpdateStreamResponse>(
			`/streams/${streamId}`,
			{
				...changes
			},
			this._token
		);

		const [stream] = await SessionContainer.instance().streams.resolve({
			type: MessageType.Streams,
			data: [response.stream]
		});

		return { stream: stream as T };
	}

	@log()
	async updateStreamMembership(request: UpdateStreamMembershipRequest) {
		const response = await this.put<CSUpdateStreamRequest, CSUpdateStreamResponse>(
			`/streams/${request.streamId}`,
			{
				$push: request.add == null ? undefined : { memberIds: request.add },
				$pull: request.remove == null ? undefined : { memberIds: request.remove }
			},
			this._token
		);

		const [stream] = await SessionContainer.instance().streams.resolve({
			type: MessageType.Streams,
			data: [response.stream]
		});

		return { stream: stream as CSChannelStream };
	}

	@log()
	@lspHandler(CreateTeamRequestType)
	createTeam(request: CreateTeamRequest) {
		return this.post("/teams", request, this._token);
	}

	@lspHandler(SendPasswordResetEmailRequestType)
	async sendPasswordResetEmail(request: SendPasswordResetEmailRequest) {
		await this.put("/no-auth/forgot-password", request);
	}

	@log()
	fetchTeams(request: FetchTeamsRequest) {
		let params = "";
		if (request.mine) {
			params = `&mine`;
		}

		if (request.teamIds && request.teamIds.length) {
			params += `&ids=${request.teamIds.join(",")}`;
		}

		return this.get<CSGetTeamsResponse>(
			`/teams${params ? `?${params.substring(1)}` : ""}`,
			this._token
		);
	}

	@log()
	getTeam(request: GetTeamRequest) {
		return this.get<CSGetTeamResponse>(`/teams/${request.teamId}`, this._token);
	}

	convertUserIdToCodeStreamUserId(id: string): string {
		return id;
	}

	@log()
	async fetchUsers(request: FetchUsersRequest) {
		const response = await this.get<CSGetUsersResponse>(
			`/users?teamId=${this.teamId}`,
			this._token
		);

		if (this._user === undefined) {
			const meResponse = await this.getMe();
			this._user = meResponse.user;
		}

		// Find ourselves and replace it with our model
		const index = response.users.findIndex(u => u.id === this._userId);
		response.users.splice(index, 1, this._user);
		return response;
	}

	@log()
	getUser(request: GetUserRequest) {
		if (request.userId === this.userId) {
			return this.getMe();
		}

		return this.get<CSGetUserResponse>(`/users/${request.userId}`, this._token);
	}

	@log()
	inviteUser(request: InviteUserRequest) {
		return this.post<CSInviteUserRequest, CSInviteUserResponse>(
			"/users",
			{ ...request, teamId: this.teamId },
			this._token
		);
	}

	@log()
	async getPreferences() {
		await this._subscribePromise;
		return { preferences: this._preferences!.get() };
	}

	@log()
	async getTelemetryKey(): Promise<string> {
		const telemetrySecret = "84$gTe^._qHm,#D";
		const response = await this.get<CSGetTelemetryKeyResponse>(
			`/no-auth/telemetry-key?secret=${encodeURIComponent(telemetrySecret)}`
		);
		return response.key;
	}

	@log()
	async connectThirdPartyProvider(request: { providerId: string }) {
		const cc = Logger.getCorrelationContext();
		try {
			const provider = getProvider(request.providerId);
			if (!provider) throw new Error(`provider ${request.providerId} not found`);
			const providerConfig = provider.getConfig();

			const response = await this.get<{ code: string }>(
				`/provider-auth-code?teamId=${this.teamId}`,
				this._token
			);
			const params: { [key: string]: string } = {
				code: response.code
			};
			if (providerConfig.isEnterprise) {
				params.host = providerConfig.host;
			}
			const query = Object.keys(params)
				.map(param => `${param}=${encodeURIComponent(params[param])}`)
				.join("&");
			await openUrl(`${this.baseUrl}/no-auth/provider-auth/${providerConfig.name}?${query}`);
			return response;
		} catch (ex) {
			Logger.error(ex, cc);
			throw ex;
		}
	}

	@log({
		args: {
			0: (request: ThirdPartyProviderSetTokenRequest) => `${request.providerId}, ${request.host}`
		}
	})
	async setThirdPartyProviderToken(request: ThirdPartyProviderSetTokenRequest) {
		const cc = Logger.getCorrelationContext();
		try {
			const provider = getProvider(request.providerId);
			if (!provider) throw new Error(`provider ${request.providerId} not found`);
			const providerConfig = provider.getConfig();

			const params: ThirdPartyProviderSetTokenRequestData = {
				teamId: this.teamId,
				host: request.host,
				token: request.token,
				data: request.data
			};

			void (await this.put<ThirdPartyProviderSetTokenRequestData, {}>(
				`/provider-set-token/${providerConfig.name}`,
				params,
				this._token
			));
		} catch (ex) {
			Logger.error(ex, cc);
			throw ex;
		}
	}

	@log()
	async setThirdPartyProviderInfo(request: {
		providerId: string;
		host: string;
		data: { [key: string]: any };
	}) {
		const cc = Logger.getCorrelationContext();
		try {
			const provider = getProvider(request.providerId);
			if (!provider) throw new Error(`provider ${request.providerId} not found`);
			const providerConfig = provider.getConfig();

			const params: { teamId: string; host: string; data: { [key: string]: any } } = {
				teamId: this.teamId,
				host: request.host,
				data: request.data
			};

			void (await this.put<{ teamId: string; host: string; data: { [key: string]: any } }, {}>(
				`/provider-info/${providerConfig.name}`,
				params,
				this._token
			));
		} catch (ex) {
			Logger.error(ex, cc);
			throw ex;
		}
	}

	@log()
	async disconnectThirdPartyProvider(request: { providerId: string }) {
		const cc = Logger.getCorrelationContext();
		try {
			const provider = getProvider(request.providerId);
			if (!provider) throw new Error(`provider ${request.providerId} not found`);
			const providerConfig = provider.getConfig();

			const params: { teamId: string; host?: string } = {
				teamId: this.teamId
			};
			if (providerConfig.isEnterprise) {
				params.host = providerConfig.host;
			}

			void (await this.put<{ teamId: string; host?: string }, {}>(
				`/provider-deauth/${providerConfig.name}`,
				params,
				this._token
			));
		} catch (ex) {
			Logger.error(ex, cc);
			throw ex;
		}
	}

	@log({
		args: { 1: () => false }
	})
	async refreshAuthProvider<T extends CSRefreshableProviderInfos>(
		providerId: string,
		providerInfo: T
	): Promise<T> {
		const cc = Logger.getCorrelationContext();

		try {
			const url = `/provider-refresh/${providerId}?teamId=${this.teamId}&refreshToken=${providerInfo.refreshToken}`;
			const response = await this.get<{ user: any }>(url, this._token);

			// Since we are dealing with identity auth don't try to resolve this with the users
			// The "me" user will get updated via the pubnub message
			let user: Partial<CSMe>;
			if (isDirective(response.user)) {
				user = {
					id: response.user.id,
					providerInfo: { [this.teamId]: { [providerId]: { ...providerInfo } } }
				};
				user = resolve(user as any, response.user);
			} else {
				user = response.user;
			}
			return user.providerInfo![this.teamId][providerId] as T;
		} catch (ex) {
			Logger.error(ex, cc);
			throw ex;
		}
	}

	@log({
		args: { 1: () => false }
	})
	async refreshThirdPartyProvider(request: {
		providerId: string;
		refreshToken: string;
	}): Promise<CSMe> {
		const cc = Logger.getCorrelationContext();
		try {
			const provider = getProvider(request.providerId);
			if (!provider) throw new Error(`provider ${request.providerId} not found`);
			const providerConfig = provider.getConfig();

			const params: { [key: string]: string } = {
				teamId: this.teamId,
				token: request.refreshToken
			};
			if (providerConfig.isEnterprise) {
				params.host = providerConfig.host;
			}

			const team = `teamId=${this.teamId}`;
			const token = `refreshToken=${request.refreshToken}`;
			const host = providerConfig.isEnterprise
				? `&host=${encodeURIComponent(providerConfig.host!)}`
				: "";
			const url = `/provider-refresh/${providerConfig.name}?${team}&${token}${host}`;
			const response = await this.get<{ user: any }>(url, this._token);

			const [user] = await SessionContainer.instance().users.resolve({
				type: MessageType.Users,
				data: [response.user]
			});

			return user as CSMe;
		} catch (ex) {
			Logger.error(ex, cc);
			throw ex;
		}
	}

	@log()
	async addEnterpriseProviderHost(request: AddEnterpriseProviderHostRequest): Promise<AddEnterpriseProviderHostResponse> {
		const cc = Logger.getCorrelationContext();
		try {
			const response = await this.put<CSAddProviderHostRequest, CSAddProviderHostResponse>(
				`/provider-host/${request.provider}/${request.teamId}`,
				{ host: request.host, ...request.data },
				this._token
			);

			await Container.instance().teams.resolve({
				type: MessageType.Teams,
				data: [response.team]
			});
			Container.instance().session.updateProviders();
			return { providerId: response.providerId };
		} catch (ex) {
			Logger.error(ex, cc);
			throw ex;
		}
	}

	private delete<R extends object>(url: string, token?: string): Promise<R> {
		let resp = undefined;
		if (resp === undefined) {
			resp = this.fetch<R>(url, { method: "DELETE" }, token) as Promise<R>;
		}
		return resp;
	}

	private get<R extends object>(url: string, token?: string): Promise<R> {
		return this.fetch<R>(url, { method: "GET" }, token) as Promise<R>;
	}

	private post<RQ extends object, R extends object>(
		url: string,
		body: RQ,
		token?: string
	): Promise<R> {
		return this.fetch<R>(
			url,
			{
				method: "POST",
				body: JSON.stringify(body)
			},
			token
		);
	}

	private put<RQ extends object, R extends object>(
		url: string,
		body: RQ,
		token?: string
	): Promise<R> {
		return this.fetch<R>(
			url,
			{
				method: "PUT",
				body: JSON.stringify(body)
			},
			token
		);
	}

	/*private*/ async fetch<R extends object>(
		url: string,
		init?: RequestInit,
		token?: string
	): Promise<R> {
		const start = process.hrtime();

		const sanitizedUrl = CodeStreamApiProvider.sanitizeUrl(url);

		let traceResult;
		try {
			if (init !== undefined || token !== undefined) {
				if (init === undefined) {
					init = {};
				}

				if (init.headers === undefined) {
					init.headers = new Headers();
				}

				if (init.headers instanceof Headers) {
					init.headers.append("Accept", "application/json");
					init.headers.append("Content-Type", "application/json");

					if (token !== undefined) {
						init.headers.append("Authorization", `Bearer ${token}`);
					}

					init.headers.append("X-CS-Plugin-IDE", this._version.ide.name);
					init.headers.append(
						"X-CS-Plugin-Version",
						`${this._version.extension.version}+${this._version.extension.build}`
					);
					init.headers.append("X-CS-IDE-Version", this._version.ide.version);
				}
			}

			if (this._proxyAgent !== undefined) {
				if (init === undefined) {
					init = {};
				}

				init.agent = this._proxyAgent;
			}

			const method = (init && init.method) || "GET";
			const absoluteUrl = `${this.baseUrl}${url}`;

			const context =
				this._middleware.length > 0
					? ({
							url: absoluteUrl,
							method: method,
							request: init
					  } as CodeStreamApiMiddlewareContext)
					: undefined;

			if (context !== undefined) {
				for (const mw of this._middleware) {
					if (mw.onRequest === undefined) continue;

					try {
						await mw.onRequest(context);
					} catch (ex) {
						Logger.error(
							ex,
							`API: ${method} ${sanitizedUrl}: Middleware(${mw.name}).onRequest FAILED`
						);
					}
				}
			}

			let json: Promise<R> | undefined;
			if (context !== undefined) {
				for (const mw of this._middleware) {
					if (mw.onProvideResponse === undefined) continue;

					try {
						json = mw.onProvideResponse(context!);
						if (json !== undefined) break;
					} catch (ex) {
						Logger.error(
							ex,
							`API: ${method} ${sanitizedUrl}: Middleware(${mw.name}).onProvideResponse FAILED`
						);
					}
				}
			}

			let id;
			let resp;
			let retryCount = 0;
			if (json === undefined) {
				[resp, retryCount] = await this.fetchCore(0, absoluteUrl, init);
				if (context !== undefined) {
					context.response = resp;
				}

				id = resp.headers.get("x-request-id");

				if (resp.ok) {
					traceResult = `API(${id}): Completed ${method} ${sanitizedUrl}`;
					json = resp.json() as Promise<R>;
				}
			}

			if (context !== undefined) {
				for (const mw of this._middleware) {
					if (mw.onResponse === undefined) continue;

					try {
						await mw.onResponse(context!, json);
					} catch (ex) {
						Logger.error(
							ex,
							`API(${id}): ${method} ${sanitizedUrl}: Middleware(${mw.name}).onResponse FAILED`
						);
					}
				}
			}

			if (resp !== undefined && !resp.ok) {
				traceResult = `API(${id}): FAILED(${retryCount}x) ${method} ${sanitizedUrl}`;
				throw await this.handleErrorResponse(resp);
			}

			const _json = await json!;

			if (Container.instance().agent.recordRequests && init) {
				const now = Date.now();
				const { method, body } = init;

				const fs = require("fs");
				const sanitize = require("sanitize-filename");
				const urlForFilename = sanitize(
					sanitizedUrl
						.split("?")[0]
						.replace(/\//g, "_")
						.replace("_", "")
				);
				const filename = `/tmp/dump-${now}-csapi-${method}-${urlForFilename}.json`;

				const out = {
					url: url,
					request: typeof body === "string" ? JSON.parse(body) : body,
					response: _json
				};
				const outString = JSON.stringify(out, null, 2);

				fs.writeFile(filename, outString, "utf8", () => {
					Logger.log(`Written ${filename}`);
				});
			}

			return CodeStreamApiProvider.normalizeResponse(_json);
		} finally {
			Logger.log(
				`${traceResult}${
					init && init.body ? ` body=${CodeStreamApiProvider.sanitize(init && init.body)}` : ""
				} \u2022 ${Strings.getDurationMilliseconds(start)} ms`
			);
		}
	}

	private async fetchCore(
		count: number,
		url: string,
		init?: RequestInit
	): Promise<[Response, number]> {
		try {
			const resp = await fetch(url, init);
			if (resp.status < 200 || resp.status > 299) {
				if (resp.status < 400 || resp.status >= 500) {
					count++;
					if (count <= 3) {
						await Functions.wait(250 * count);
						return this.fetchCore(count, url, init);
					}
				}
			}
			return [resp, count];
		} catch (ex) {
			Logger.error(ex);

			count++;
			if (count <= 3) {
				await Functions.wait(250 * count);
				return this.fetchCore(count, url, init);
			}

			throw ex;
		}
	}

	private async handleErrorResponse(response: Response): Promise<Error> {
		let message = response.statusText;
		let data;
		if (response.status >= 400 && response.status < 500) {
			try {
				data = await response.json();
				if (data.code) {
					message += `(${data.code})`;
				}
				if (data.message) {
					message += `: ${data.message}`;
				}
				if (data.info && data.info.name) {
					message += `\n${data.info.name}`;
				}
			} catch {}
		}
		return new ServerError(message, data, response.status);
	}

	// TODO: Move somewhere more generic
	static isStreamSubscriptionRequired(stream: CSStream, userId: string): boolean {
		if (stream.deactivated || stream.type === StreamType.File) return false;
		if (stream.type === StreamType.Channel) {
			if (stream.memberIds === undefined) return false;
			if (!stream.memberIds.includes(userId)) return false;
		}
		return true;
	}

	// TODO: Move somewhere more generic
	static isStreamUnsubscribeRequired(stream: CSStream, userId: string): boolean {
		if (stream.type !== StreamType.Channel) {
			return false;
		}
		if (stream.memberIds && !stream.memberIds.includes(userId)) {
			return true;
		}
		return false;
	}

	static normalizeResponse<R extends object>(obj: { [key: string]: any }): R {
		// FIXME maybe the api server should never return arrays with null elements?
		if (obj != null) {
			for (const [key, value] of Object.entries(obj)) {
				if (key === "_id") {
					obj["id"] = value;
				}

				if (Array.isArray(value)) {
					obj[key] = value.map(v => this.normalizeResponse(v));
				} else if (typeof value === "object") {
					obj[key] = this.normalizeResponse(value);
				}
			}
		}

		return obj as R;
	}

	static sanitize(
		body:
			| string
			| ArrayBuffer
			| ArrayBufferView
			| NodeJS.ReadableStream
			| URLSearchParams
			| undefined
	) {
		if (body === undefined || typeof body !== "string") return "";

		return body.replace(
			/("\w*?apikey\w*?":|"\w*?password\w*?":|"\w*?secret\w*?":|"\w*?token\w*?":)".*?"/gi,
			'$1"<hidden>"'
		);
	}

	static sanitizeUrl(url: string) {
		return url.replace(
			/(\b\w*?apikey\w*?=|\b\w*?password\w*?=|\b\w*?secret\w*?=|\b\w*?token\w*?=)(?:.+?)(?=&|$)/gi,
			"$1<hidden>"
		);
	}
}
