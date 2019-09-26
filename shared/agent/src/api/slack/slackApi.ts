"use strict";
import {
	Block,
	KnownBlock,
	LogLevel,
	WebAPICallOptions,
	WebAPICallResult,
	WebClient,
	WebClientEvent
} from "@slack/web-api";
import HttpsProxyAgent from "https-proxy-agent";
import { RequestInit } from "node-fetch";
import { Emitter, Event } from "vscode-languageserver";
import { Container, SessionContainer } from "../../container";
import { Logger, TraceLevel } from "../../logger";
import {
	AddEnterpriseProviderHostRequest,
	ArchiveStreamRequest,
	Capabilities,
	CloseStreamRequest,
	ConnectionStatus,
	CreateChannelStreamRequest,
	CreateCodemarkPermalinkRequest,
	CreateCodemarkRequest,
	CreateDirectStreamRequest,
	CreateMarkerLocationRequest,
	CreatePostRequest,
	CreatePostResponse,
	CreateRepoRequest,
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
	FetchStreamsResponse,
	FetchTeamsRequest,
	FetchUnreadStreamsRequest,
	FetchUsersRequest,
	GetCodemarkRequest,
	GetMarkerRequest,
	GetPostRequest,
	GetPostsRequest,
	GetPreferencesResponse,
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
	MuteStreamResponse,
	OpenStreamRequest,
	PinReplyToCodemarkRequest,
	ReactToPostRequest,
	RenameStreamRequest,
	SetCodemarkPinnedRequest,
	SetCodemarkStatusRequest,
	SetStreamPurposeRequest,
	UnarchiveStreamRequest,
	Unreads,
	UpdateCodemarkRequest,
	UpdateMarkerRequest,
	UpdatePreferencesRequest,
	UpdatePresenceRequest,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse
} from "../../protocol/agent.protocol";
import {
	CSApiCapabilities,
	CSChannelStream,
	CSCodemark,
	CSDirectStream,
	CSGetMeResponse,
	CSMarker,
	CSMarkerLocations,
	CSMe,
	CSPost,
	CSRepository,
	CSSlackProviderInfo,
	CSStream,
	CSTeam,
	CSUser,
	ProviderType,
	StreamType
} from "../../protocol/api.protocol";
import { debug, Functions, log, Strings } from "../../system";
import {
	ApiProvider,
	ApiProviderLoginResponse,
	CodeStreamApiMiddleware,
	LoginOptions,
	MessageType,
	RTMessage,
	StreamsRTMessage
} from "../apiProvider";
import { CodeStreamApiProvider } from "../codestream/codestreamApi";
import { CodeStreamPreferences } from "../preferences";
import { SlackEvents } from "./events";
import {
	fromSlackChannel,
	fromSlackChannelIdToType,
	fromSlackChannelOrDirect,
	fromSlackDirect,
	fromSlackPost,
	fromSlackPostId,
	fromSlackUser,
	toSlackPostBlocks,
	toSlackPostText,
	toSlackTeam
} from "./slackApi.adapters";
import { SlackUnreads } from "./unreads";

interface DeferredStreamRequest<TResult> {
	action(): Promise<TResult>;
	grouping: number;
	order: number;
	stream: {
		id: string;
		priority?: number;
	};
}

const meMessageRegex = /^\/me /;

export class SlackApiProvider implements ApiProvider {
	private _onDidReceiveMessage = new Emitter<RTMessage>();
	get onDidReceiveMessage(): Event<RTMessage> {
		return this._onDidReceiveMessage.event;
	}

	private _slack: WebClient;
	private _events: SlackEvents | undefined;
	private readonly _codestreamUserId: string;
	private _codestreamTeam: CSTeam | undefined;
	private readonly _slackToken: string;
	private readonly _slackUserId: string;

	private _preferences: CodeStreamPreferences;
	private readonly _unreads: SlackUnreads;
	// TODO: Convert to index on UserManager?
	private _usernamesById: Map<string, string> | undefined;
	// TODO: Convert to index on UserManager?
	private _userIdsByName: Map<string, string> | undefined;

	readonly capabilities: Capabilities = {
		channelMute: false,
		postDelete: true,
		postEdit: true,
		// webview uses this to see if the provider can upgrade to realtime.
		// to hide the channels tab -- make this false
		providerCanSupportRealtimeChat: true,
		providerSupportsRealtimeChat: false,
		// agent uses this
		providerSupportsRealtimeEvents: false
	};

	constructor(
		private _codestream: CodeStreamApiProvider,
		providerInfo: CSSlackProviderInfo,
		user: CSMe,
		private readonly _codestreamTeamId: string,
		private readonly _proxyAgent: HttpsProxyAgent | undefined
	) {
		this._slackToken = providerInfo.accessToken;
		this._slack = this.newWebClient();

		this._slack.on(WebClientEvent.RATE_LIMITED, retryAfter => {
			Logger.log(
				`SlackApiProvider request was rate limited and future requests will be paused for ${retryAfter} seconds`
			);
		});

		this._unreads = new SlackUnreads(this);
		this._unreads.onDidChange(this.onUnreadsChanged, this);

		this._preferences = new CodeStreamPreferences(user.preferences);

		this._codestreamUserId = user.id;
		this._slackUserId = providerInfo.userId;
	}

	protected newWebClient() {
		return new WebClient(this._slackToken, {
			agent: this._proxyAgent,
			logLevel: Logger.level === TraceLevel.Debug ? LogLevel.DEBUG : LogLevel.INFO,
			logger: {
				setLevel() {},
				setName() {},
				debug(...msgs) {
					Logger.debug("SLACK", ...msgs);
				},
				info(...msgs) {
					Logger.log("SLACK", ...msgs);
				},
				warn(...msgs) {
					Logger.warn("SLACK", ...msgs);
				},
				error(...msgs) {
					Logger.warn("SLACK [ERROR]", ...msgs);
				}
			}
		});
	}

	@log({
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

							// if (!this._events!.connected) {
							// 	Logger.log(
							// 		`SlackApiProvider.onCodeStreamMessage(${
							// 			e.type
							// 		}); Slack RTM lost its connection, reconnecting...`
							// 	);
							// 	void SessionContainer.instance().session.reset(ResetReason.LostConnection);

							// 	void (await this._events!.reconnect());
							// }

							break;
					}
					break;

				case MessageType.Preferences:
					this._preferences.update(e.data);
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
		// Setup the capabilites based on the provider mode
		if (response.token.providerAccess === "strict") {
			this.capabilities.providerSupportsRealtimeChat = false;
			this.capabilities.providerSupportsRealtimeEvents = false;
		} else {
			this.capabilities.providerSupportsRealtimeChat = true;
			this.capabilities.providerSupportsRealtimeEvents = true;
		}

		if (!this.capabilities.providerSupportsRealtimeEvents) {
			// Turn off post caching if the provider doesn't support real-time events
			SessionContainer.instance().posts.disableCache();
		}
		Logger.log(`providerAccess=${response.token.providerAccess}`);

		// Mix in slack user info with ours
		const meResponse = await this.getMeCore({ user: response.user });

		// TODO: Correlate codestream ids to slack ids once the server returns that info
		// const users = await this._codestream.fetchUsers({});
		// users;

		const team = response.teams.find(t => t.id === this._codestreamTeamId);
		this._codestreamTeam = team;
		if (team !== undefined) {
			toSlackTeam(team, await this.ensureUsernamesById());
		}

		response.user = meResponse.user;
	}

	private async getSlackPreferences() {
		// Use real-time events as a proxy for limited-slack mode (which can't use undocumented apis)
		if (!this.capabilities.providerSupportsRealtimeEvents) {
			return { muted_channels: "" };
		}

		try {
			// Undocumented API: https://github.com/ErikKalkoken/slackApiDoc/blob/master/users.prefs.get.md
			const response = await this.slackApiCall("users.prefs.get", undefined);

			const { ok, error, prefs } = response as WebAPICallResult & { prefs: any };
			if (!ok) {
				Logger.error(new Error(error));
				return { muted_channels: "" };
			}

			return prefs as { [key: string]: any };
		} catch (ex) {
			Logger.error(ex);
			return { muted_channels: "" };
		}
	}

	get codestreamUserId(): string {
		return this._codestreamUserId!;
	}

	get teamId(): string {
		return this._codestreamTeamId!;
	}

	get unreads(): SlackUnreads {
		return this._unreads;
	}

	get userId(): string {
		return this._slackUserId;
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
		if (this.capabilities.providerSupportsRealtimeEvents) {
			this._events = this.newSlackEvents();
			this._events.onDidReceiveMessage(e => {
				if (e.type === MessageType.Preferences) {
					this._preferences.update(e.data);
				} else {
					this._onDidReceiveMessage.fire(e);
				}
			});
		}

		this._preferences.onDidChange(preferences => {
			this._onDidReceiveMessage.fire({ type: MessageType.Preferences, data: preferences });
		});

		this.getInitialPreferences().then(preferences => {
			this._preferences.update(preferences);
		});

		if (this._events !== undefined) {
			const usernamesById = await this.ensureUsernamesById();
			await this._events.connect([...usernamesById.keys()]);
		}

		this._codestream.onDidReceiveMessage(this.onCodeStreamMessage, this);
		await this._codestream.subscribe([
			MessageType.Codemarks,
			MessageType.Connection,
			MessageType.MarkerLocations,
			MessageType.Markers,
			MessageType.Preferences,
			MessageType.Repositories,
			MessageType.Teams,
			MessageType.Users
		]);
	}

	protected newSlackEvents() {
		return new SlackEvents(this._slackToken, this, this._proxyAgent);
	}

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
			? ((await users.getByIdFromCache(this._slackUserId)) as CSMe)
			: undefined;

		let me = meResponse.user;
		me.codestreamId = me.id;
		me.id = this.userId;

		const response = await this.slackApiCall("users.info", {
			user: this.userId
		});

		let user;

		const { ok, user: usr } = response as WebAPICallResult & { user: any };
		if (ok) {
			// Don't need to pass the codestream users here, since we set the codestreamId already above
			user = fromSlackUser(usr, this._codestreamTeamId, []);
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
		}

		if (me.lastReads == null) {
			me.lastReads = {};
		}

		try {
			const { muted_channels } = await this.getSlackPreferences();

			// Don't update our prefs, since they aren't per-team
			// void this.updatePreferences({
			// 	preferences: {
			// 		$set: { mutedStreams: mutedStreams }
			// 	}
			// });

			me.preferences = {
				...me.preferences,
				mutedStreams: muted_channels
					.split(",")
					.reduce((result: object, streamId: string) => ({ ...result, [streamId]: true }), {})
			};
		} catch (ex) {
			Logger.error(ex);
		}

		SessionContainer.instance().users.resolve({ type: MessageType.Users, data: [me] });

		return { user: me };
	}

	@log()
	getUnreads(request: GetUnreadsRequest) {
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
			let meMessage = meMessageRegex.test(text);
			// If we are trying post a me message as a reply, send it as a normal reply with /me replaced with the username
			if (meMessage && request.parentPostId != null) {
				text = text.replace(meMessageRegex, `${usernamesById.get(this._slackUserId)} `);
				meMessage = false;
			}

			if (text) {
				text = toSlackPostText(text, userIdsByName, request.mentionedUserIds);
			}

			const { streamId, postId: parentPostId } = fromSlackPostId(
				request.parentPostId,
				request.streamId!
			);

			if (meMessage) {
				const response = await this.slackApiCall("chat.meMessage", {
					channel: streamId,
					text: text
				});

				const { ok, error, ts: postId } = response as WebAPICallResult & { ts?: any };
				if (!ok) throw new Error(error);

				const postResponse = await this.getPost({ streamId: streamId, postId: postId });
				return postResponse;
			}

			let blocks: (KnownBlock | Block)[] | undefined;
			let codemark: CSCodemark | undefined;
			let markers: CSMarker[] | undefined;
			let markerLocations: CSMarkerLocations[] | undefined;
			let streams: CSStream[] | undefined;
			let repos: CSRepository[] | undefined;

			if (request.codemark != null) {
				const codemarkResponse = await this.createCodemark({
					...request.codemark,
					parentPostId: request.parentPostId,
					providerType: ProviderType.Slack
				});

				({ codemark, markers, markerLocations, streams, repos } = codemarkResponse);

				blocks = toSlackPostBlocks(
					codemark,
					request.codemark.remotes,
					markers,
					markerLocations,
					usernamesById,
					userIdsByName
				);

				// Set the fallback (notification) content for the message
				text = `${codemark.title || ""}${
					codemark.title && codemark.text ? `\n\n` : ""
				}${codemark.text || ""}`;
			}

			const response = await this.slackApiCall("chat.postMessage", {
				channel: streamId,
				text: text,
				as_user: true,
				thread_ts: parentPostId,
				unfurl_links: true,
				reply_broadcast: false, // parentPostId ? true : undefined --- because of slack bug (https://trello.com/c/Y48QI6Z9/919)
				blocks: blocks !== undefined ? blocks : undefined
			});

			const { ok, error, message } = response as WebAPICallResult & { message?: any; ts?: any };
			if (!ok) throw new Error(error);

			const post = await fromSlackPost(message, streamId, usernamesById, this._codestreamTeamId);
			const { postId } = fromSlackPostId(post.id, post.streamId);
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

			const postResponse = await this.getPost({ streamId: streamId, postId: postId });
			return {
				post: postResponse.post,
				codemark,
				markers,
				markerLocations,
				streams,
				repos
			};
		} finally {
			if (createdPostId) {
				this._codestream.trackProviderPost({
					provider: "slack",
					teamId: this.teamId,
					streamId: request.streamId,
					postId: createdPostId,
					parentPostId: request.parentPostId
				});
			}
		}
	}

	@log()
	async deletePost(request: DeletePostRequest) {
		const { streamId, postId } = fromSlackPostId(request.postId, request.streamId);
		const postResponse = await this.getPost({ streamId: streamId, postId: postId });

		const response = await this.slackApiCall("chat.delete", {
			channel: streamId,
			ts: postId,
			as_user: true
		});

		if (postResponse.post.codemarkId) {
			await this._codestream.deleteCodemark({
				codemarkId: postResponse.post.codemarkId
			});
		}

		const { ok, error } = response as WebAPICallResult;
		if (!ok) throw new Error(error);

		postResponse.post.deactivated = true;
		return { post: postResponse.post };
	}

	@log()
	async editPost(request: EditPostRequest) {
		const { streamId, postId } = fromSlackPostId(request.postId, request.streamId);

		let text;
		if (request.text) {
			text = toSlackPostText(
				request.text,
				await this.ensureUserIdsByName(),
				request.mentionedUserIds
			);
		} else {
			text = request.text;
		}

		const response = await this.slackApiCall("chat.update", {
			channel: streamId,
			ts: postId,
			as_user: true,
			text: text
		});

		const { ok, error } = response as WebAPICallResult;
		if (!ok) throw new Error(error);

		const postResponse = await this.getPost({ streamId: streamId, postId: postId });
		return postResponse;
	}

	@log()
	async fetchPostReplies(request: FetchPostRepliesRequest) {
		const { streamId, postId } = fromSlackPostId(request.postId, request.streamId);

		let response;

		// *.replies below don't support pagination, but if/when we switch to conversations.replies we will need to paginate

		// This isn't ideal, but we can always pack some more info into the id to ensure we call the right thing
		switch (fromSlackChannelIdToType(streamId)) {
			case "channel":
				response = await this.slackApiCall("channels.replies", {
					channel: streamId,
					thread_ts: postId
				});

				break;

			case "group":
				response = await this.slackApiCall("groups.replies", {
					channel: streamId,
					thread_ts: postId as any // Slack has the wrong typing here
				});

				break;

			case "direct":
				response = await this.slackApiCall("im.replies", {
					channel: streamId,
					thread_ts: postId
				});
				break;
		}

		const { ok, messages } = response as WebAPICallResult & { messages: any };
		// TODO: For now don't throw errors until we deal with marker privacy
		if (!ok) return { posts: [] };
		// if (!ok) throw new Error(error);

		// Filter out the parent post (don't ask me why slack includes it) and ensure the correct ordering
		messages.filter((m: any) => m.ts !== postId).sort((a: any, b: any) => a.ts - b.ts);

		const usernamesById = await this.ensureUsernamesById();
		const posts = await Promise.all(messages.map((m: any) =>
			fromSlackPost(m, streamId, usernamesById, this._codestreamTeamId)
		) as Promise<CSPost>[]);

		return { posts: posts };
	}

	@log()
	async fetchPosts(request: FetchPostsRequest) {
		let response;
		const codemarksPromise = SessionContainer.instance().codemarks.getAllCached();

		// This isn't ideal, but we can always pack some more info into the id to ensure we call the right thing
		switch (fromSlackChannelIdToType(request.streamId)) {
			case "channel":
				response = await this.slackApiCall("channels.history", {
					channel: request.streamId,
					count: request.limit || 100,
					oldest: request.after == null ? undefined : String(request.after),
					latest: request.before == null ? undefined : String(request.before),
					inclusive: request.inclusive
				});

				break;

			case "group":
				response = await this.slackApiCall("groups.history", {
					channel: request.streamId,
					count: request.limit || 100,
					oldest: request.after == null ? undefined : String(request.after),
					latest: request.before == null ? undefined : String(request.before),
					inclusive: request.inclusive
				});

				break;

			case "direct":
				response = await this.slackApiCall("im.history", {
					channel: request.streamId,
					count: request.limit || 100,
					oldest: request.after == null ? undefined : String(request.after),
					latest: request.before == null ? undefined : String(request.before),
					inclusive: request.inclusive
				});
				break;
		}

		// Can't use the Conversations API because replies aren't included in the main channel/group/im
		// const response = await this.slack.conversations.history({
		// 	channel: request.streamId,
		// 	limit: request.limit || 100,
		//  oldest: request.after == null ? undefined : String(request.after),
		//  latest: request.before == null ? undefined : String(request.before),
		//  inclusive: request.inclusive
		// });

		const { ok, error, messages, has_more } = response as WebAPICallResult & {
			messages: any;
			has_more?: boolean;
		};
		if (!ok) throw new Error(error);

		// Ensure the correct ordering
		messages.sort((a: any, b: any) => a.ts - b.ts);

		const usernamesById = await this.ensureUsernamesById();
		await codemarksPromise;
		const posts = await Promise.all(messages.map((m: any) =>
			fromSlackPost(m, request.streamId, usernamesById, this._codestreamTeamId)
		) as Promise<CSPost>[]);

		return { posts: posts, more: has_more };
	}

	@log()
	async getPost(request: GetPostRequest) {
		const { streamId, postId } = fromSlackPostId(request.postId, request.streamId);

		let response;

		// This isn't ideal, but we can always pack some more info into the id to ensure we call the right thing
		switch (fromSlackChannelIdToType(streamId)) {
			case "channel":
				response = await this.slackApiCall("channels.history", {
					channel: streamId,
					count: 1,
					latest: postId,
					inclusive: true
				});

				break;

			case "group":
				response = await this.slackApiCall("groups.history", {
					channel: streamId,
					count: 1,
					latest: postId,
					inclusive: true
				});

				break;

			case "direct":
				response = await this.slackApiCall("im.history", {
					channel: streamId,
					count: 1,
					latest: postId,
					inclusive: true
				});
				break;
		}

		// Can't use the Conversations API because replies aren't included in the main channel/group/im
		// const response = await "conversations.history", {
		// 	channel: streamId,
		// 	limit: 1,
		// 	inclusive: true,
		// 	latest: postId
		// };

		const { ok, error, messages } = response as WebAPICallResult & { messages: any };
		if (!ok) {
			throw new Error(error);
		}

		const message = messages[0];
		// Since we can end up with a post NEAREST postId rather than postId, make sure we found the right post
		if (message.ts !== postId) {
			throw new Error(`Unable to find message with id=${postId}`);
		}

		const usernamesById = await this.ensureUsernamesById();
		const post = await fromSlackPost(message, streamId, usernamesById, this._codestreamTeamId);

		return { post: post };
	}

	@log()
	async getPosts(request: GetPostsRequest) {
		const responses = await Promise.all(
			request.postIds.map(id => this.getPost({ streamId: request.streamId, postId: id }))
		);
		const posts: CSPost[] = [];
		responses.forEach(p => posts.push(p.post));
		return { posts };
	}

	@log()
	async markPostUnread(request: MarkPostUnreadRequest) {
		const { streamId, postId } = fromSlackPostId(request.postId, request.streamId);

		let response;

		// This isn't ideal, but we can always pack some more info into the id to ensure we call the right thing
		switch (fromSlackChannelIdToType(streamId)) {
			case "channel": {
				response = await this.slackApiCall("channels.mark", { channel: streamId, ts: postId });
				const { ok, error } = response as WebAPICallResult;
				if (!ok) throw new Error(error);

				break;
			}
			case "group": {
				response = await this.slackApiCall("groups.mark", { channel: streamId, ts: postId });
				const { ok, error } = response as WebAPICallResult;
				if (!ok) throw new Error(error);

				break;
			}
			case "direct": {
				response = await this.slackApiCall("im.mark", { channel: streamId, ts: postId });
				const { ok, error } = response as WebAPICallResult;
				if (!ok) throw new Error(error);
				break;
			}
		}

		return this.getPost({ streamId: streamId, postId: postId });
	}

	@log()
	async reactToPost(request: ReactToPostRequest) {
		const { streamId, postId } = fromSlackPostId(request.postId, request.streamId);

		let response;

		for (const [name, value] of Object.entries(request.emojis)) {
			if (value) {
				response = await this.slackApiCall("reactions.add", {
					channel: streamId,
					timestamp: postId,
					name: name
				});
			} else {
				response = await this.slackApiCall("reactions.remove", {
					channel: streamId,
					timestamp: postId,
					name: name
				});
			}
		}

		const { ok, error } = response as WebAPICallResult;
		if (!ok) throw new Error(error);

		return this.getPost({ streamId: streamId, postId: postId });
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
	async createChannelStream(request: CreateChannelStreamRequest) {
		if (request.isTeamStream || request.memberIds == null) {
			throw new Error("Cannot create team streams on Slack");
		}

		// Remove ourselves from the membership list
		const index = request.memberIds.findIndex(m => m === this._slackUserId);
		if (index !== -1) {
			request.memberIds.splice(index, 1);
		}

		const response = await this.slackApiCall("conversations.create", {
			name: request.name,
			is_private: request.privacy === "private",
			user_ids: request.memberIds.length === 0 ? undefined : request.memberIds.join(",")
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		if (channel.members == null || channel.members.length === 0) {
			const members = await this.getStreamMembers(channel.id);
			if (request.memberIds.length !== members.length - 1) {
				const membershipResponse = await this.updateStreamMembership({
					streamId: channel.id,
					add: request.memberIds
				});

				// Since updateStreamMembership already updated the cache we can just return the response
				return membershipResponse;
			} else {
				channel.members = members;
			}
		}

		const stream = fromSlackChannelOrDirect(
			channel,
			await this.ensureUsernamesById(),
			this._slackUserId,
			this._codestreamTeamId
		)!;

		const streams = await SessionContainer.instance().streams.resolve({
			type: MessageType.Streams,
			data: [stream]
		});

		return { stream: streams[0] as CSChannelStream };
	}

	@log()
	async createDirectStream(request: CreateDirectStreamRequest) {
		const cc = Logger.getCorrelationContext();

		const response = await this.slackApiCall("conversations.open", {
			users: request.memberIds.join(","),
			return_im: true
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		try {
			const members = await this.getStreamMembers(channel.id);
			channel.members = members;
		} catch (ex) {
			Logger.error(ex, cc);

			channel.members = request.memberIds;
		}

		const stream = fromSlackChannelOrDirect(
			channel,
			await this.ensureUsernamesById(),
			this._slackUserId,
			this._codestreamTeamId
		)!;

		const streams = await SessionContainer.instance().streams.resolve({
			type: MessageType.Streams,
			data: [stream]
		});

		return { stream: streams[0] as CSDirectStream };
	}

	@log({
		exit: (r: FetchStreamsResponse) =>
			`\n${r.streams
				.map(
					s =>
						`\t${s.id} = ${s.name}${s.priority == null ? "" : `, p=${s.priority}`}${
							s.type === StreamType.Direct ? `, closed=${s.isClosed}` : ""
						}`
				)
				.join("\n")}\ncompleted`
	})
	async fetchStreams(request: FetchStreamsRequest) {
		const cc = Logger.getCorrelationContext();

		try {
			const responses = await this.slackApiCallPaginated("users.conversations", {
				exclude_archived: true,
				types: "public_channel,private_channel,mpim,im",
				limit: 1000
			});

			const start = process.hrtime();
			Logger.log(cc, "Fetching pages...");

			const conversations = [];
			for await (const response of responses) {
				const { ok, error, channels: data } = response as WebAPICallResult & {
					channels: any[];
				};
				if (!ok) throw new Error(error);

				Logger.log(
					cc,
					`Fetched page; cursor=${response.response_metadata &&
						response.response_metadata.next_cursor}`
				);

				conversations.push(...data);
			}

			Logger.log(cc, `Fetched pages \u2022 ${Strings.getDurationMilliseconds(start)} ms`);

			const usernamesById = await this.ensureUsernamesById();
			const counts = await this.fetchCounts();

			const pendingRequestsQueue: DeferredStreamRequest<CSChannelStream | CSDirectStream>[] = [];

			const [channels, groups, ims] = await Promise.all([
				this.fetchChannels(
					// Filter out shared channels for now, until we can convert to the conversation apis
					conversations.filter(c => c.is_channel && !c.is_shared),
					counts && counts.channels,
					pendingRequestsQueue
				),
				this.fetchGroups(
					// Filter out shared channels for now, until we can convert to the conversation apis
					conversations.filter(c => c.is_group && !c.is_shared),
					usernamesById,
					counts && counts.groups,
					pendingRequestsQueue
				),
				this.fetchIMs(
					conversations.filter(c => c.is_im),
					usernamesById,
					counts && counts.ims,
					pendingRequestsQueue
				)
			]);

			const streams = channels.concat(...groups, ...ims);

			if (counts !== undefined) {
				this._unreads.updateFromCounts(counts);
			}

			if (this.capabilities.providerSupportsRealtimeEvents && pendingRequestsQueue.length !== 0) {
				this.processPendingStreamsQueue(pendingRequestsQueue);
			}

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
	async fetchCounts(): Promise<
		| {
				channels: { [id: string]: any };
				groups: { [id: string]: any };
				ims: { [id: string]: any };
		  }
		| undefined
	> {
		// Use real-time events as a proxy for limited-slack mode (which can't use undocumented apis)
		if (!this.capabilities.providerSupportsRealtimeEvents) {
			return undefined;
		}

		const cc = Logger.getCorrelationContext();

		try {
			// Undocumented API
			const response = await this.slackApiCall("users.counts", {
				include_threads: true,
				// mpim_aware: true,
				only_relevant_ims: true,
				simple_unreads: true
			});

			const { ok, error, channels, groups, ims } = response as WebAPICallResult & {
				channels: any[];
				groups: any[];
				ims: any[];
			};
			if (!ok) throw new Error(error);

			return {
				channels: (channels == null ? [] : channels).reduce((map, c) => {
					if (!c.is_archived) {
						map[c.id] = c;
					}
					return map;
				}, Object.create(null)),
				groups: (groups == null ? [] : groups).reduce((map, g) => {
					if (!g.is_archived) {
						map[g.id] = g;
					}
					return map;
				}, Object.create(null)),
				ims: (ims == null ? [] : ims).reduce((map, im) => {
					map[im.id] = im;
					return map;
				}, Object.create(null))
			};
		} catch (ex) {
			Logger.error(ex, cc);
			return undefined;
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

	@log({
		args: false,
		correlate: true,
		enter: q => `fetching ${q.length} stream(s) in the background...`
	})
	protected async processPendingStreamsQueue(
		queue: DeferredStreamRequest<CSChannelStream | CSDirectStream>[]
	) {
		const cc = Logger.getCorrelationContext();

		queue.sort((a, b) => b.grouping - a.grouping || a.order - b.order);

		const { streams } = SessionContainer.instance();

		const notifyThrottle = 4000;
		let timeSinceLastNotification = new Date().getTime();
		const completed: (CSChannelStream | CSDirectStream)[] = [];

		let failed = 0;
		while (queue.length) {
			const deferred = queue.shift();
			if (deferred === undefined) continue;

			try {
				const timeoutMs = 30000;
				const timer = setTimeout(async () => {
					Logger.warn(
						cc,
						`TIMEOUT ${timeoutMs / 1000}s exceeded while fetching stream '${
							deferred.stream.id
						}' in the background`
					);

					if (completed.length !== 0) {
						const message: StreamsRTMessage = { type: MessageType.Streams, data: completed };
						message.data = await streams.resolve(message);
						this._onDidReceiveMessage.fire(message);

						completed.length = 0;
						timeSinceLastNotification = new Date().getTime();
					}
				}, timeoutMs);

				const stream = await deferred.action();
				// Since the info calls may not return the priority, preserve the existing state
				if (stream.type === StreamType.Direct && stream.priority == null) {
					stream.priority = deferred.stream.priority;
				}

				clearTimeout(timer);
				completed.push(stream);
			} catch {
				failed++;
			}

			if (
				queue.length === 0 ||
				(completed.length !== 0 &&
					new Date().getTime() - timeSinceLastNotification > notifyThrottle)
			) {
				const message: StreamsRTMessage = { type: MessageType.Streams, data: completed };
				message.data = await streams.resolve(message);
				this._onDidReceiveMessage.fire(message);

				completed.length = 0;
				timeSinceLastNotification = new Date().getTime();
			}
		}

		if (failed > 0) {
			Logger.debug(cc, `Failed fetching ${failed} stream(s) in the background`);
		}
	}

	@debug({ args: false })
	private async fetchChannels(
		channels: any | undefined,
		countsByChannel: { [id: string]: any } | undefined,
		pendingQueue: DeferredStreamRequest<CSChannelStream | CSDirectStream>[]
	): Promise<(CSChannelStream | CSDirectStream)[]> {
		const cc = Logger.getCorrelationContext();

		if (channels === undefined) {
			const responses = await this.slackApiCallPaginated("channels.list", {
				exclude_archived: true,
				exclude_members: false,
				limit: 1000
			});

			const start = process.hrtime();
			Logger.log(cc, "Fetching pages...");

			channels = [];
			for await (const response of responses) {
				const { ok, error, channels: data } = response as WebAPICallResult & {
					channels: any[];
				};
				if (!ok) throw new Error(error);

				Logger.log(
					cc,
					`Fetched page; cursor=${response.response_metadata &&
						response.response_metadata.next_cursor}`
				);

				channels.push(...data);
			}

			Logger.log(cc, `Fetched pages \u2022 ${Strings.getDurationMilliseconds(start)} ms`);
		}

		const streams = [];
		let pending:
			| {
					action(): Promise<CSChannelStream>;
					id: string;
					name: string;
			  }[]
			| undefined;

		let counts;
		let s;
		for (const c of channels) {
			if (c.is_archived) continue;

			if (countsByChannel != null) {
				counts = countsByChannel[c.id];
				if (counts !== undefined) {
					if (counts.latest != null) {
						c.latest = { ts: counts.latest };
					}
				}
			}

			s = fromSlackChannel(c, this._slackUserId, this._codestreamTeamId);
			streams.push(s);

			if (countsByChannel !== undefined && counts === undefined) continue;

			// if (c.is_member) {
			if (pending === undefined) {
				pending = [];
			}

			pending.push({
				action: () => this.fetchChannel(c.id),
				id: c.id,
				name: c.name as string
			});
			// }
		}

		if (pending !== undefined) {
			pending.sort((a, b) => a.name.localeCompare(b.name));

			const index = 0;
			for (const p of pending) {
				pendingQueue.push({ action: p.action, grouping: 10, order: index, stream: { id: p.id } });
			}
		}

		return streams;
	}

	@log({
		args: false,
		prefix: (context, id) => `${context.prefix}(${id})`
	})
	private async fetchChannel(id: string) {
		const cc = Logger.getCorrelationContext();

		try {
			const response = await this.slackApiCall("channels.info", {
				channel: id
			});

			const { ok, error, channel } = response as WebAPICallResult & { channel: any };
			if (!ok) throw new Error(error);

			this._unreads.update(channel.id, channel.last_read, 0, channel.unread_count_display || 0);

			return fromSlackChannel(channel, this._slackUserId, this._codestreamTeamId);
		} catch (ex) {
			Logger.error(ex, cc);
			throw ex;
		}
	}

	@debug({ args: false })
	private async fetchGroups(
		groups: any | undefined,
		usernamesById: Map<string, string>,
		countsByGroup: { [id: string]: any } | undefined,
		pendingQueue: DeferredStreamRequest<CSChannelStream | CSDirectStream>[]
	): Promise<(CSChannelStream | CSDirectStream)[]> {
		const cc = Logger.getCorrelationContext();

		if (groups === undefined) {
			const responses = await this.slackApiCallPaginated("groups.list", {
				exclude_archived: true,
				exclude_members: false,
				limit: 1000
			});

			const start = process.hrtime();
			Logger.log(cc, "Fetching pages...");

			groups = [];
			for await (const response of responses) {
				const { ok, error, groups: data } = response as WebAPICallResult & {
					groups: any[];
				};
				if (!ok) throw new Error(error);

				Logger.log(
					cc,
					`Fetched page; cursor=${response.response_metadata &&
						response.response_metadata.next_cursor}`
				);

				groups.push(...data);
			}

			Logger.log(cc, `Fetched pages \u2022 ${Strings.getDurationMilliseconds(start)} ms`);
		}
		const streams = [];
		let pending:
			| {
					action(): Promise<CSChannelStream | CSDirectStream>;
					grouping: number;
					id: string;
					priority: number;
			  }[]
			| undefined;
		let counts;
		let s;
		for (const g of groups) {
			if (g.is_archived) continue;

			if (countsByGroup != null) {
				counts = countsByGroup[g.id];
				if (counts !== undefined) {
					g.is_open = counts.is_open;
					if (counts.latest != null) {
						g.latest = { ts: counts.latest };
					}
				} else {
					g.is_open = false;
				}
			}

			s = fromSlackChannelOrDirect(g, usernamesById, this._slackUserId, this._codestreamTeamId);
			if (s !== undefined) {
				streams.push(s);
			}

			if (countsByGroup !== undefined && counts === undefined) continue;

			if (g.is_open !== false) {
				if (pending === undefined) {
					pending = [];
				}

				pending.push({
					action: () => this.fetchGroup(g.id, usernamesById),
					grouping: g.is_mpim ? 1 : 5,
					id: g.id,
					priority: (g.priority || 0) as number
				});
			}
		}

		if (pending !== undefined) {
			pending.sort((a, b) => b.priority - a.priority);

			const index = 0;
			for (const p of pending) {
				pendingQueue.push({
					action: p.action,
					grouping: p.grouping,
					order: index,
					stream: { id: p.id, priority: p.priority }
				});
			}
		}

		return streams;
	}

	@log({
		args: false,
		prefix: (context, id) => `${context.prefix}(${id})`
	})
	private async fetchGroup(id: any, usernamesById: Map<string, string>) {
		const cc = Logger.getCorrelationContext();

		try {
			const response = await this.slackApiCall("groups.info", {
				channel: id
			});

			const { ok, error, group } = response as WebAPICallResult & { group: any };
			if (!ok) throw new Error(error);

			this._unreads.update(
				group.id,
				group.last_read,
				group.is_mpim ? group.unread_count_display || 0 : 0,
				group.unread_count_display || 0
			);

			return fromSlackChannelOrDirect(
				group,
				usernamesById,
				this._slackUserId,
				this._codestreamTeamId
			)!;
		} catch (ex) {
			Logger.error(ex, cc);
			throw ex;
		}
	}

	@debug({ args: false })
	private async fetchIMs(
		ims: any | undefined,
		usernamesById: Map<string, string>,
		countsByIM: { [id: string]: any } | undefined,
		pendingQueue: DeferredStreamRequest<CSChannelStream | CSDirectStream>[]
	): Promise<(CSChannelStream | CSDirectStream)[]> {
		const cc = Logger.getCorrelationContext();

		if (ims === undefined) {
			const responses = await this.slackApiCallPaginated("im.list", {
				limit: 1000
			});

			const start = process.hrtime();
			Logger.log(cc, "Fetching pages...");

			ims = [];
			for await (const response of responses) {
				const { ok, error, ims: data } = response as WebAPICallResult & {
					ims: any[];
				};
				if (!ok) throw new Error(error);

				Logger.log(
					cc,
					`Fetched page; cursor=${response.response_metadata &&
						response.response_metadata.next_cursor}`
				);

				ims.push(...data);
			}

			Logger.log(cc, `Fetched pages \u2022 ${Strings.getDurationMilliseconds(start)} ms`);
		}

		const streams = [];
		let pending:
			| {
					action(): Promise<CSDirectStream>;
					id: string;
					priority: number;
			  }[]
			| undefined;
		let counts;
		let s;
		for (const im of ims) {
			if (im.is_user_deleted) continue;

			if (countsByIM != null) {
				counts = countsByIM[im.id];
				if (counts !== undefined) {
					im.is_open = counts.is_open;
					if (counts.latest != null) {
						im.latest = { ts: counts.latest };
					}
				} else {
					im.is_open = false;
				}
			}

			s = fromSlackDirect(im, usernamesById, this._slackUserId, this._codestreamTeamId);
			streams.push(s);

			if (countsByIM !== undefined && counts === undefined) continue;

			if (s.isClosed !== false) {
				if (pending === undefined) {
					pending = [];
				}

				pending.push({
					action: () => this.fetchIM(im.id, usernamesById),
					id: im.id,
					priority: (im.priority || 0) as number
				});
			}
		}

		if (pending !== undefined) {
			pending.sort((a, b) => b.priority - a.priority);

			const index = 0;
			for (const p of pending) {
				pendingQueue.push({
					action: p.action,
					grouping: 0,
					order: index,
					stream: { id: p.id, priority: p.priority }
				});
			}
		}

		return streams;
	}

	@log({
		args: false,
		prefix: (context, id) => `${context.prefix}(${id})`
	})
	private async fetchIM(id: string, usernamesById: Map<string, string>) {
		const cc = Logger.getCorrelationContext();

		try {
			const response = await this.slackApiCall("conversations.info", {
				channel: id
			});

			const { ok, error, channel } = response as WebAPICallResult & { channel: any };
			if (!ok) throw new Error(error);

			this._unreads.update(
				channel.id,
				channel.last_read,
				channel.unread_count_display || 0,
				channel.unread_count_display || 0
			);

			return fromSlackDirect(channel, usernamesById, this._slackUserId, this._codestreamTeamId);
		} catch (ex) {
			Logger.error(ex, cc);
			throw ex;
		}
	}

	@log()
	async fetchUnreadStreams(request: FetchUnreadStreamsRequest) {
		// TODO:
		return { streams: [] };
	}

	@log()
	async getStream(request: GetStreamRequest) {
		if (request.type === StreamType.File) {
			return this._codestream.getStream(request);
		}

		let stream;
		switch (fromSlackChannelIdToType(request.streamId)) {
			case "channel":
				stream = await this.fetchChannel(request.streamId);
				break;
			case "group":
				stream = await this.fetchGroup(request.streamId, await this.ensureUsernamesById());
				break;
			case "direct":
				stream = await this.fetchIM(request.streamId, await this.ensureUsernamesById());
				break;
			default:
				throw new Error(`Invalid stream type: ${request.streamId}`);
		}

		return { stream: stream };
	}

	@log()
	private async getStreamMembers(streamId: string) {
		const cc = Logger.getCorrelationContext();

		const responses = await this.slackApiCallPaginated("conversations.members", {
			channel: streamId,
			limit: 1000
		});

		const members = [];
		for await (const response of responses) {
			const { ok, error, members: data } = response as WebAPICallResult & {
				members: string[];
			};
			if (!ok) throw new Error(error);

			Logger.log(
				cc,
				`Fetched page; cursor=${response.response_metadata &&
					response.response_metadata.next_cursor}`
			);

			members.push(...data);
		}

		return members;
	}

	@log()
	async archiveStream(request: ArchiveStreamRequest) {
		const response = await this.slackApiCall("conversations.archive", {
			channel: request.streamId
		});

		const { ok, error } = response as WebAPICallResult;
		if (!ok) throw new Error(error);

		const streamResponse = await this.getStream({ streamId: request.streamId });
		const streams = await SessionContainer.instance().streams.resolve({
			type: MessageType.Streams,
			data: [streamResponse.stream]
		});

		return { stream: streams[0] as CSChannelStream };
	}

	@log()
	async closeStream(request: CloseStreamRequest) {
		const response = await this.slackApiCall("conversations.close", {
			channel: request.streamId
		});

		const { ok, error, no_op } = response as WebAPICallResult & { no_op: boolean };
		if (!ok) throw new Error(error);

		if (no_op) {
			const stream = await SessionContainer.instance().streams.getById(request.streamId);
			return { stream: stream! as CSDirectStream };
		}

		const streamResponse = await this.getStream({ streamId: request.streamId });
		const streams = await SessionContainer.instance().streams.resolve({
			type: MessageType.Streams,
			data: [streamResponse.stream]
		});

		return { stream: streams[0] as CSDirectStream };
	}

	@log()
	async joinStream(request: JoinStreamRequest) {
		const response = await this.slackApiCall("conversations.join", {
			channel: request.streamId
		});

		const { ok, error } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const streamResponse = await this.getStream({ streamId: request.streamId });
		const streams = await SessionContainer.instance().streams.resolve({
			type: MessageType.Streams,
			data: [streamResponse.stream]
		});

		return { stream: streams[0] as CSChannelStream };
	}

	@log()
	async leaveStream(request: LeaveStreamRequest) {
		const cc = Logger.getCorrelationContext();

		// Get a copy of the original stream & copy its membership array (since it will be mutated)
		const originalStream = {
			...(await SessionContainer.instance().streams.getById(request.streamId))
		};
		if (originalStream.memberIds != null) {
			originalStream.memberIds = originalStream.memberIds.slice(0);
		}

		const response = await this.slackApiCall("conversations.leave", {
			channel: request.streamId
		});

		const { ok, error, not_in_channel } = response as WebAPICallResult & {
			not_in_channel: boolean;
		};
		if (!ok) throw new Error(error);

		if (not_in_channel) {
			const stream = await SessionContainer.instance().streams.getById(request.streamId);
			return { stream: stream! as CSChannelStream };
		}

		try {
			const [stream] = await SessionContainer.instance().streams.resolve({
				type: MessageType.Streams,
				data: [
					{
						id: request.streamId,
						$pull: { memberIds: [this._slackUserId] },
						$version: { before: "*" }
					}
				]
			});
			return { stream: stream as CSChannelStream };
		} catch (ex) {
			Logger.error(ex, cc);

			// Since this can happen because we have no permission to the stream anymore,
			// simulate removing ourselves from the membership list
			if (originalStream.memberIds != null) {
				const index = originalStream.memberIds.findIndex(m => m === this._slackUserId);
				if (index !== -1) {
					originalStream.memberIds.splice(index, 1);
				}
			}
			return { stream: originalStream as CSChannelStream };
		}
	}

	@log()
	async markStreamRead(request: MarkStreamReadRequest) {
		let response = await this.slackApiCall("conversations.info", {
			channel: request.streamId
		});

		const { ok, error, channel: c } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const { postId } = fromSlackPostId(
			request.postId || (c.latest && c.latest.ts),
			request.streamId
		);
		if (postId == null) return {};

		if (c.is_channel) {
			response = await this.slackApiCall("channels.mark", { channel: c.id, ts: postId });
			return {};
		}

		if (c.is_group) {
			response = await this.slackApiCall("groups.mark", { channel: c.id, ts: postId });
			return {};
		}

		if (c.is_im) {
			response = await this.slackApiCall("im.mark", { channel: c.id, ts: postId });
			return {};
		}

		return {};
	}

	@log()
	async muteStream(request: MuteStreamRequest): Promise<MuteStreamResponse> {
		throw new Error("Method not implemented.");
	}

	@log()
	async openStream(request: OpenStreamRequest) {
		const cc = Logger.getCorrelationContext();

		const response = await this.slackApiCall("conversations.open", {
			channel: request.streamId,
			return_im: true
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		try {
			const members = await this.getStreamMembers(channel.id);
			channel.members = members;
		} catch (ex) {
			Logger.error(ex, cc);

			const stream = await SessionContainer.instance().streams.getById(request.streamId);
			channel.members = stream.memberIds;
		}

		const stream = fromSlackChannelOrDirect(
			channel,
			await this.ensureUsernamesById(),
			this._slackUserId,
			this._codestreamTeamId
		)!;

		const streams = await SessionContainer.instance().streams.resolve({
			type: MessageType.Streams,
			data: [stream]
		});

		return { stream: streams[0] as CSDirectStream };
	}

	@log()
	async renameStream(request: RenameStreamRequest) {
		const response = await this.slackApiCall("conversations.rename", {
			channel: request.streamId,
			name: request.name
		});

		const { ok, error } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const streamResponse = await this.getStream({ streamId: request.streamId });
		const streams = await SessionContainer.instance().streams.resolve({
			type: MessageType.Streams,
			data: [streamResponse.stream]
		});

		return { stream: streams[0] as CSChannelStream };
	}

	@log()
	async setStreamPurpose(request: SetStreamPurposeRequest) {
		const response = await this.slackApiCall("conversations.setPurpose", {
			channel: request.streamId,
			purpose: request.purpose
		});

		const { ok, error } = response as WebAPICallResult & { purpose: any };
		if (!ok) throw new Error(error);

		const streamResponse = await this.getStream({ streamId: request.streamId });
		const streams = await SessionContainer.instance().streams.resolve({
			type: MessageType.Streams,
			data: [streamResponse.stream]
		});

		return { stream: streams[0] as CSChannelStream };
	}

	@log()
	async unarchiveStream(request: UnarchiveStreamRequest) {
		const response = await this.slackApiCall("conversations.unarchive", {
			channel: request.streamId
		});

		const { ok, error } = response as WebAPICallResult;
		if (!ok) throw new Error(error);

		const streamResponse = await this.getStream({ streamId: request.streamId });
		const streams = await SessionContainer.instance().streams.resolve({
			type: MessageType.Streams,
			data: [streamResponse.stream]
		});

		return { stream: streams[0] as CSChannelStream };
	}

	@log()
	async updateStreamMembership(
		request: UpdateStreamMembershipRequest
	): Promise<UpdateStreamMembershipResponse> {
		const errors = [];
		if (request.add != null && request.add.length !== 0) {
			const response = await this.slackApiCall("conversations.invite", {
				channel: request.streamId,
				users: request.add.join(",")
			});

			const { ok, error } = response as WebAPICallResult;
			if (!ok) {
				errors.push(error);
			}
		}

		if (request.remove != null && request.remove.length !== 0) {
			for (const userId of request.remove) {
				const response = await this.slackApiCall("conversations.kick", {
					channel: request.streamId,
					user: userId
				});

				const { ok, error } = response as WebAPICallResult;
				if (!ok) {
					errors.push(error);
				}
			}
		}

		if (errors.length !== 0) throw new Error(errors.join(", "));

		const streamResponse = await this.getStream({ streamId: request.streamId });
		const streams = await SessionContainer.instance().streams.resolve({
			type: MessageType.Streams,
			data: [streamResponse.stream]
		});

		return { stream: streams[0] as CSChannelStream };
	}

	@log()
	async fetchTeams(request: FetchTeamsRequest) {
		const response = await this._codestream.fetchTeams(request);

		// Replace the current team's ids with slack ids
		const team = response.teams.find(t => t.id === this._codestreamTeamId);
		if (team !== undefined) {
			toSlackTeam(team, await this.ensureUsernamesById());
		}

		return response;
	}

	@log()
	async getTeam(request: GetTeamRequest) {
		const response = await this._codestream.getTeam(request);

		// Replace the current team's ids with slack ids
		if (response.team != null && response.team.id === this._codestreamTeamId) {
			toSlackTeam(response.team, await this.ensureUsernamesById());
		}

		return response;
	}

	private _userIdMap: Map<string, string> | undefined;
	convertUserIdToCodeStreamUserId(id: string): string {
		if (this._userIdMap === undefined) return id;

		return this._userIdMap.get(id) || id;
	}

	@log()
	async fetchUsers(request: FetchUsersRequest) {
		const cc = Logger.getCorrelationContext();

		const [responses, { user: me }, { users: codestreamUsers }] = await Promise.all([
			this.slackApiCallPaginated("users.list", { limit: 1000 }),
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

		const members = [];
		for await (const response of responses) {
			const { ok, error, members: data } = response as WebAPICallResult & {
				members: any[];
			};
			if (!ok) throw new Error(error);

			Logger.log(
				cc,
				`Fetched page; cursor=${response.response_metadata &&
					response.response_metadata.next_cursor}`
			);

			members.push(...data);
		}

		const users: CSUser[] = members.map((m: any) =>
			// Find ourselves and replace it with our model
			m.id === this._slackUserId ? me : fromSlackUser(m, this._codestreamTeamId, codestreamUsers)
		);
		// Don't filter out deactivated users anymore to allow codemark by deleted users to show up properly
		// .filter(u => !u.deactivated);

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

		// HACK: Forward to CodeStream if this isn't a slack user id
		if (!request.userId.startsWith("U") && !request.userId.startsWith("W")) {
			return this._codestream.getUser(request);
		}

		const [response, { users: codestreamUsers }] = await Promise.all([
			this.slackApiCall("users.info", {
				user: request.userId
			}),
			(this._codestreamTeam !== undefined
				? Promise.resolve({ team: this._codestreamTeam })
				: this._codestream.getTeam({ teamId: this._codestreamTeamId })
			).then(({ team }) =>
				this._codestream.fetchUsers({
					userIds: team.memberIds
				})
			)
		]);

		const { ok, error, user: usr } = response as WebAPICallResult & { user: any };
		if (!ok) throw new Error(error);

		const user = fromSlackUser(usr, this._codestreamTeamId, codestreamUsers);

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
	addEnterpriseProviderHost(request: AddEnterpriseProviderHostRequest) {
		return this._codestream.addEnterpriseProviderHost(request);
	}

	@log()
	disconnectThirdPartyProvider(request: { providerId: string }) {
		return this._codestream.disconnectThirdPartyProvider(request);
	}

	@log()
	refreshThirdPartyProvider(request: { providerId: string; refreshToken: string }): Promise<CSMe> {
		return this._codestream.refreshThirdPartyProvider(request);
	}

	@debug({
		args: false,
		prefix: (context, method, request) =>
			`${context.prefix} ${method}(${
				request != null
					? Logger.toLoggable(request, (key, value) =>
							logFilterKeys.has(key) ? `<${key}>` : Logger.sanitize(key, value)
					  )
					: ""
			})`
	})
	protected async slackApiCall<
		TRequest extends WebAPICallOptions,
		TResponse extends WebAPICallResult
	>(method: string, request?: TRequest): Promise<TResponse> {
		const cc = Logger.getCorrelationContext();

		const timeoutMs = 30000;
		try {
			const response = await Functions.cancellable(
				this._slack.apiCall(method, request),
				timeoutMs,
				{
					cancelMessage: cc && cc.prefix,
					onDidCancel: (resolve, reject) => Logger.warn(cc, `TIMEOUT ${timeoutMs / 1000}s exceeded`)
				}
			);

			if (Container.instance().agent.recordRequests) {
				const now = Date.now();
				// const { method, body } = init;

				const fs = require("fs");
				const sanitize = require("sanitize-filename");
				const sanitizedMethod = sanitize(
					method
					// .split("?")[0]
					// .replace(/\//g, "_")
					// .replace("_", "")
				);
				const filename = `/tmp/dump-${now}-slack-${sanitizedMethod}.json`;

				const out = {
					url: method,
					request: request,
					response: response
				};
				const outString = JSON.stringify(out, null, 2);

				fs.writeFile(filename, outString, "utf8", () => {
					Logger.log(`Written ${filename}`);
				});
			}

			return response as TResponse;
		} catch (ex) {
			Logger.error(ex, cc, ex.data != null ? JSON.stringify(ex.data) : undefined);
			throw ex;
		}
	}

	@debug({
		args: false,
		prefix: (context, method, request) =>
			`${context.prefix} ${method}(${
				request != null
					? Logger.toLoggable(request, (key, value) =>
							logFilterKeys.has(key) ? `<${key}>` : Logger.sanitize(key, value)
					  )
					: ""
			})`
	})
	protected async slackApiCallPaginated<
		TRequest extends WebAPICallOptions,
		TResponse extends WebAPICallResult
	>(method: string, request: TRequest): Promise<AsyncIterableIterator<TResponse>> {
		const cc = Logger.getCorrelationContext();

		try {
			const response = this._slack.paginate(method, request);
			return response as AsyncIterableIterator<TResponse>;
		} catch (ex) {
			Logger.error(ex, cc, ex.data != null ? JSON.stringify(ex.data) : undefined);
			throw ex;
		}
	}

	async dispose() {
		await this._codestream.dispose();
		if (this._events !== undefined) {
			await this._events.dispose();
		}
	}
}

const logFilterKeys = new Set(["text", "attachments"]);
