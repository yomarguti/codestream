"use strict";
import { LogLevel, WebAPICallResult, WebClient } from "@slack/client";
import HttpsProxyAgent from "https-proxy-agent";
import { RequestInit } from "node-fetch";
import { Emitter, Event } from "vscode-languageserver";
import { Container } from "../../container";
import { Logger, TraceLevel } from "../../logger";
import {
	ArchiveStreamRequest,
	CloseStreamRequest,
	ConnectionStatus,
	CreateChannelStreamRequest,
	CreateDirectStreamRequest,
	CreateMarkerLocationRequest,
	CreatePostRequest,
	CreatePostResponse,
	CreateRepoRequest,
	CSUnreads,
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
	ReactToPostRequest,
	RenameStreamRequest,
	SetCodemarkStatusRequest,
	SetStreamPurposeRequest,
	UnarchiveStreamRequest,
	UpdateCodemarkRequest,
	UpdateMarkerRequest,
	UpdatePreferencesRequest,
	UpdatePresenceRequest,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse
} from "../../shared/agent.protocol";
import {
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
	CSUser,
	LoginResponse,
	ProviderType,
	StreamType
} from "../../shared/api.protocol";
import { debug, Functions, log } from "../../system";
import {
	ApiProvider,
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
	toSlackPostAttachment,
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
	private readonly _slackToken: string;
	private readonly _slackUserId: string;

	private _preferences: CodeStreamPreferences;
	private readonly _unreads: SlackUnreads;
	// TODO: Convert to index on UserManager?
	private _usernamesById: Map<string, string> | undefined;
	// TODO: Convert to index on UserManager?
	private _userIdsByName: Map<string, string> | undefined;

	readonly capabilities = {
		mute: false
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

		this._slack.on("rate_limited", retryAfter => {
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
			logger: (level, message) => Logger.log(`SLACK[${level}]: ${message}`)
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

				// TODO: I think we need to handle these
				// case MessageType.Preferences:
				// 	this._preferences.update(e.data);
				// 	break;

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

	private onUnreadsChanged(e: CSUnreads) {
		try {
			this._onDidReceiveMessage.fire({ type: MessageType.Unreads, data: e });
		} catch (ex) {
			Logger.error(ex);
		}
	}

	async processLoginResponse(response: LoginResponse): Promise<void> {
		// Mix in slack user info with ours
		const meResponse = await this.getMeCore({ user: response.user });

		// TODO: Correlate codestream ids to slack ids once the server returns that info
		// const users = await this._codestream.fetchUsers({});
		// users;

		const team = response.teams.find(t => t.id === this._codestreamTeamId);
		if (team !== undefined) {
			toSlackTeam(team, await this.ensureUsernamesById());
		}

		response.user = meResponse.user;
	}

	private async getSlackPreferences() {
		try {
			// Undocumented: https://github.com/ErikKalkoken/slackApiDoc/blob/master/users.prefs.get.md
			const response = await this.slackApiCall("users.prefs.get", undefined, "users.prefs.get");

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

	async login(options: LoginOptions): Promise<LoginResponse & { teamId: string }> {
		throw new Error("Not supported");
	}

	@log()
	async subscribe(types?: MessageType[]) {
		this._events = this.newSlackEvents();
		this._events.onDidReceiveMessage(e => {
			if (e.type === MessageType.Preferences) {
				this._preferences.update(e.data);
			} else {
				this._onDidReceiveMessage.fire(e);
			}
		});

		this._preferences.onDidChange(preferences => {
			this._onDidReceiveMessage.fire({ type: MessageType.Preferences, data: preferences });
		});

		this.getInitialPreferences().then(preferences => {
			this._preferences.update(preferences);
		});

		const usernamesById = await this.ensureUsernamesById();
		await this._events.connect([...usernamesById.keys()]);

		this._codestream.onDidReceiveMessage(this.onCodeStreamMessage, this);
		await this._codestream.subscribe([
			MessageType.Codemarks,
			MessageType.Connection,
			MessageType.MarkerLocations,
			MessageType.Markers,
			// TODO: I think we need to subscribe to these
			// MessageType.Preferences,
			MessageType.Repositories,
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
			const users = (await Container.instance().users.get()).users;

			this._usernamesById = new Map();
			this._userIdsByName = new Map();

			for (const user of users) {
				this._usernamesById.set(user.id, user.username);
				this._userIdsByName.set(user.username, user.id);
			}
		}
	}

	grantPubNubChannelAccess(token: string, channel: string): Promise<{}> {
		if (channel === `user-${this.userId}`) {
			channel = `user-${this.codestreamUserId}`;
		}

		return this._codestream.grantPubNubChannelAccess(token, channel);
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
		const prevMe = (await Container.instance().users.getByIdFromCache(this._slackUserId)) as CSMe;

		let me = meResponse.user;
		me.id = this.userId;

		const response = await this.slackApiCall(
			this._slack.users.info,
			{
				user: this.userId
			},
			`users.info`
		);

		let user;

		const { ok, error, user: usr } = response as WebAPICallResult & { user: any };
		if (ok) {
			user = fromSlackUser(usr, this._codestreamTeamId);
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

		Container.instance().users.resolve({ type: MessageType.Users, data: [me] });

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
	fetchCodemarks(request: FetchCodemarksRequest) {
		return this._codestream.fetchCodemarks(request);
	}

	@log()
	getCodemark(request: GetCodemarkRequest) {
		return this._codestream.getCodemark(request);
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

			let text = request.text;
			let meMessage = meMessageRegex.test(text);
			// If we are trying post a me message as a reply, send it as a normal reply with /me replaced with the username
			if (meMessage && request.parentPostId != null) {
				text = text.replace(meMessageRegex, `${usernamesById.get(this._slackUserId)} `);
				meMessage = false;
			}

			if (text) {
				text = toSlackPostText(text, request.mentionedUserIds, usernamesById);
			}

			const { streamId, postId: parentPostId } = fromSlackPostId(
				request.parentPostId,
				request.streamId!
			);

			if (meMessage) {
				const response = await this.slackApiCall(
					this._slack.chat.meMessage,
					{
						channel: streamId,
						text: text
					},
					`chat.meMessage`
				);

				const { ok, error, ts: postId } = response as WebAPICallResult & { ts?: any };
				if (!ok) throw new Error(error);

				const postResponse = await this.getPost({ streamId: streamId, postId: postId });
				return postResponse;
			}

			let attachments;
			let codemark: CSCodemark | undefined;
			let markers: CSMarker[] | undefined;
			let markerLocations: CSMarkerLocations[] | undefined;
			let streams: CSStream[] | undefined;
			let repos: CSRepository[] | undefined;

			if (request.codemark !== undefined) {
				const codemarkResponse = await this._codestream.createCodemark({
					...request.codemark,
					parentPostId: request.parentPostId,
					providerType: ProviderType.Slack
				});

				({ codemark, markers, markerLocations, streams, repos } = codemarkResponse);

				attachments = toSlackPostAttachment(
					codemark,
					request.codemark.remotes,
					markers,
					markerLocations,
					usernamesById,
					this._slackUserId
				);
			}

			const response = await this.slackApiCall(
				this._slack.chat.postMessage,
				{
					channel: streamId,
					text: text,
					as_user: true,
					thread_ts: parentPostId,
					unfurl_links: true,
					reply_broadcast: false, // parentPostId ? true : undefined --- because of slack bug (https://trello.com/c/Y48QI6Z9/919)
					attachments: attachments
				},
				`chat.postMessage`
			);

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
				this.updatePostsCount(this.teamId, request.streamId, createdPostId, request.parentPostId);
			}
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
	async deletePost(request: DeletePostRequest) {
		const { streamId, postId } = fromSlackPostId(request.postId, request.streamId);
		const postResponse = await this.getPost({ streamId: streamId, postId: postId });

		const response = await this.slackApiCall(
			this._slack.chat.delete,
			{
				channel: streamId,
				ts: postId,
				as_user: true
			},
			`chat.delete`
		);

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
				request.mentionedUserIds,
				await this.ensureUserIdsByName()
			);
		} else {
			text = request.text;
		}

		const response = await this.slackApiCall(
			this._slack.chat.update,
			{
				channel: streamId,
				ts: postId,
				as_user: true,
				text: text
			},
			`chat.update`
		);

		const { ok, error } = response as WebAPICallResult;
		if (!ok) throw new Error(error);

		const postResponse = await this.getPost({ streamId: streamId, postId: postId });
		return postResponse;
	}

	@log()
	async fetchPostReplies(request: FetchPostRepliesRequest) {
		const { streamId, postId } = fromSlackPostId(request.postId, request.streamId);

		let response;

		// This isn't ideal, but we can always pack some more info into the id to ensure we call the right thing
		switch (fromSlackChannelIdToType(streamId)) {
			case "channel":
				response = await this.slackApiCall(
					this._slack.channels.replies,
					{
						channel: streamId,
						thread_ts: postId
					},
					`channels.replies`
				);

				break;

			case "group":
				response = await this.slackApiCall(
					this._slack.groups.replies,
					{
						channel: streamId,
						thread_ts: postId as any // Slack has the wrong typing here
					},
					`groups.replies`
				);

				break;

			case "direct":
				response = await this.slackApiCall(
					this._slack.im.replies,
					{
						channel: streamId,
						thread_ts: postId
					},
					`im.replies`
				);
				break;
		}

		const { ok, error, messages } = response as WebAPICallResult & { messages: any };
		// TODO: For now don't throw errors until we deal with marker privacy
		if (!ok) return { posts: [] };
		// if (!ok) throw new Error(error);

		// Ensure the correct ordering
		messages.sort((a: any, b: any) => a.ts - b.ts);

		const usernamesById = await this.ensureUsernamesById();
		const posts = await Promise.all(messages.map((m: any) =>
			fromSlackPost(m, streamId, usernamesById, this._codestreamTeamId)
		) as Promise<CSPost>[]);

		return { posts: posts };
	}

	@log()
	async fetchPosts(request: FetchPostsRequest) {
		let response;
		const codemarksPromise = Container.instance().codemarks.ensureCached();

		// This isn't ideal, but we can always pack some more info into the id to ensure we call the right thing
		switch (fromSlackChannelIdToType(request.streamId)) {
			case "channel":
				response = await this.slackApiCall(
					this._slack.channels.history,
					{
						channel: request.streamId,
						count: request.limit || 100,
						oldest: request.after == null ? undefined : String(request.after),
						latest: request.before == null ? undefined : String(request.before),
						inclusive: request.inclusive
					},
					`channels.history`
				);

				break;

			case "group":
				response = await this.slackApiCall(
					this._slack.groups.history,
					{
						channel: request.streamId,
						count: request.limit || 100,
						oldest: request.after == null ? undefined : String(request.after),
						latest: request.before == null ? undefined : String(request.before),
						inclusive: request.inclusive
					},
					`groups.history`
				);

				break;

			case "direct":
				response = await this.slackApiCall(
					this._slack.im.history,
					{
						channel: request.streamId,
						count: request.limit || 100,
						oldest: request.after == null ? undefined : String(request.after),
						latest: request.before == null ? undefined : String(request.before),
						inclusive: request.inclusive
					},
					`im.history`
				);
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
				response = await this.slackApiCall(
					this._slack.channels.history,
					{
						channel: streamId,
						count: 1,
						latest: postId,
						inclusive: true
					},
					`channels.history`
				);

				break;

			case "group":
				response = await this.slackApiCall(
					this._slack.groups.history,
					{
						channel: streamId,
						count: 1,
						latest: postId,
						inclusive: true
					},
					`groups.history`
				);

				break;

			case "direct":
				response = await this.slackApiCall(
					this._slack.im.history,
					{
						channel: streamId,
						count: 1,
						latest: postId,
						inclusive: true
					},
					`im.history`
				);
				break;
		}

		// Can't use the Conversations API because replies aren't included in the main channel/group/im
		// const response = await this._slack.conversations.history, {
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
	async markPostUnread(request: MarkPostUnreadRequest) {
		const { streamId, postId } = fromSlackPostId(request.postId, request.streamId);

		let response;

		// This isn't ideal, but we can always pack some more info into the id to ensure we call the right thing
		switch (fromSlackChannelIdToType(streamId)) {
			case "channel": {
				response = await this.slackApiCall(
					this._slack.channels.mark,
					{ channel: streamId, ts: postId },
					`channels.mark`
				);
				const { ok, error } = response as WebAPICallResult;
				if (!ok) throw new Error(error);

				break;
			}
			case "group": {
				response = await this.slackApiCall(
					this._slack.groups.mark,
					{ channel: streamId, ts: postId },
					`groups.mark`
				);
				const { ok, error } = response as WebAPICallResult;
				if (!ok) throw new Error(error);

				break;
			}
			case "direct": {
				response = await this.slackApiCall(
					this._slack.im.mark,
					{ channel: streamId, ts: postId },
					`im.mark`
				);
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
				response = await this.slackApiCall(
					this._slack.reactions.add,
					{
						channel: streamId,
						timestamp: postId,
						name: name
					},
					`reactions.add`
				);
			} else {
				response = await this.slackApiCall(
					this._slack.reactions.remove,
					{
						channel: streamId,
						timestamp: postId,
						name: name
					},
					`reactions.remove`
				);
			}
		}

		const { ok, error } = response as WebAPICallResult;
		if (!ok) throw new Error(error);

		return this.getPost({ streamId: streamId, postId: postId });
	}

	@log()
	async setCodemarkStatus(request: SetCodemarkStatusRequest) {
		return this._codestream.setCodemarkStatus(request);
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

		const response = await this.slackApiCall(
			this._slack.conversations.create,
			{
				name: request.name,
				is_private: request.privacy === "private",
				user_ids: request.memberIds.length === 0 ? undefined : request.memberIds.join(",")
			},
			`conversations.create`
		);

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

		const streams = await Container.instance().streams.resolve({
			type: MessageType.Streams,
			data: [stream]
		});

		return { stream: streams[0] as CSChannelStream };
	}

	@log()
	async createDirectStream(request: CreateDirectStreamRequest) {
		const cc = Logger.getCorrelationContext();

		const response = await this.slackApiCall(
			this._slack.conversations.open,
			{
				users: request.memberIds.join(","),
				return_im: true
			},
			`conversations.open`
		);

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

		const streams = await Container.instance().streams.resolve({
			type: MessageType.Streams,
			data: [stream]
		});

		return { stream: streams[0] as CSDirectStream };
	}

	@log({
		exit: (r: FetchStreamsResponse) =>
			`\n${r.streams
				.map(s => `\t${s.id} = ${s.name}, p=${s.priority == null ? "" : s.priority}`)
				.join("\n")}`
	})
	async fetchStreams(request: FetchStreamsRequest) {
		const cc = Logger.getCorrelationContext();

		try {
			const response = await this.slackApiCall(
				this._slack.users.conversations,
				{
					exclude_archived: true,
					types: "public_channel,private_channel,mpim,im"
					// limit: 1000
				},
				`users.conversations`
			);

			const { ok, error, channels: conversations } = response as WebAPICallResult & {
				channels: any[];
			};
			if (!ok) throw new Error(error);

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

			if (pendingRequestsQueue.length !== 0) {
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
		const cc = Logger.getCorrelationContext();

		try {
			const response = await this.slackApiCall(
				"users.counts",
				{
					include_threads: true,
					// mpim_aware: true,
					only_relevant_ims: true,
					simple_unreads: true
				},
				`users.counts`
			);

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
	updateCodemark(request: UpdateCodemarkRequest) {
		return this._codestream.updateCodemark(request);
	}

	@log()
	deleteCodemark(request: DeleteCodemarkRequest) {
		return this._codestream.deleteCodemark(request);
	}

	@log()
	private async getInitialPreferences() {
		const { user } = await this.getMe();
		return user.preferences;
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

		const { streams } = Container.instance();

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

	private async fetchChannels(
		channels: any | undefined,
		countsByChannel: { [id: string]: any } | undefined,
		pendingQueue: DeferredStreamRequest<CSChannelStream | CSDirectStream>[]
	): Promise<(CSChannelStream | CSDirectStream)[]> {
		if (channels === undefined) {
			const response = await this.slackApiCall(
				this._slack.channels.list,
				{
					exclude_archived: true,
					exclude_members: false
					// limit: 1000
				},
				`channels.list`
			);

			const { ok, error, channels: data } = response as WebAPICallResult & { channels: any[] };
			if (!ok) throw new Error(error);

			channels = data;
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
			const response = await this.slackApiCall(
				this._slack.channels.info,
				{
					channel: id
				},
				`channels.info`
			);

			const { ok, error, channel } = response as WebAPICallResult & { channel: any };
			if (!ok) throw new Error(error);

			this._unreads.update(channel.id, channel.last_read, 0, channel.unread_count_display || 0);

			return fromSlackChannel(channel, this._slackUserId, this._codestreamTeamId);
		} catch (ex) {
			Logger.error(ex, cc);
			throw ex;
		}
	}

	private async fetchGroups(
		groups: any | undefined,
		usernamesById: Map<string, string>,
		countsByGroup: { [id: string]: any } | undefined,
		pendingQueue: DeferredStreamRequest<CSChannelStream | CSDirectStream>[]
	): Promise<(CSChannelStream | CSDirectStream)[]> {
		if (groups === undefined) {
			const response = await this.slackApiCall(
				this._slack.groups.list,
				{
					exclude_archived: true,
					exclude_members: false
					// limit: 1000
				},
				`groups.list`
			);

			const { ok, error, groups: data } = response as WebAPICallResult & { groups: any[] };
			if (!ok) throw new Error(error);

			groups = data;
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
			const response = await this.slackApiCall(
				this._slack.groups.info,
				{
					channel: id
				},
				`groups.info`
			);

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

	private async fetchIMs(
		ims: any | undefined,
		usernamesById: Map<string, string>,
		countsByIM: { [id: string]: any } | undefined,
		pendingQueue: DeferredStreamRequest<CSChannelStream | CSDirectStream>[]
	): Promise<(CSChannelStream | CSDirectStream)[]> {
		if (ims === undefined) {
			const response = await this.slackApiCall(
				this._slack.im.list,
				{
					// limit: 1000
				},
				`im.list`
			);

			const { ok, error, ims: data } = response as WebAPICallResult & { ims: any[] };
			if (!ok) throw new Error(error);

			ims = data;
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
			const response = await this.slackApiCall(
				this._slack.conversations.info,
				{
					channel: id
				},
				`conversations.info`
			);

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
		const response = await this.slackApiCall(
			this._slack.conversations.members,
			{
				channel: streamId
				// limit: 1000
			},
			`conversations.members`
		);

		const { ok, error, members } = response as WebAPICallResult & { members: string[] };
		if (!ok) throw new Error(error);

		return members;
	}

	@log()
	async archiveStream(request: ArchiveStreamRequest) {
		const response = await this.slackApiCall(
			this._slack.conversations.archive,
			{
				channel: request.streamId
			},
			`conversations.archive`
		);

		const { ok, error } = response as WebAPICallResult;
		if (!ok) throw new Error(error);

		const streamResponse = await this.getStream({ streamId: request.streamId });
		const streams = await Container.instance().streams.resolve({
			type: MessageType.Streams,
			data: [streamResponse.stream]
		});

		return { stream: streams[0] as CSChannelStream };
	}

	@log()
	async closeStream(request: CloseStreamRequest) {
		const response = await this.slackApiCall(
			this._slack.conversations.close,
			{
				channel: request.streamId
			},
			`conversations.close`
		);

		const { ok, error, no_op } = response as WebAPICallResult & { no_op: boolean };
		if (!ok) throw new Error(error);

		if (no_op) {
			const stream = await Container.instance().streams.getById(request.streamId);
			return { stream: stream! as CSDirectStream };
		}

		const streamResponse = await this.getStream({ streamId: request.streamId });
		const streams = await Container.instance().streams.resolve({
			type: MessageType.Streams,
			data: [streamResponse.stream]
		});

		return { stream: streams[0] as CSDirectStream };
	}

	@log()
	async joinStream(request: JoinStreamRequest) {
		const response = await this.slackApiCall(
			this._slack.conversations.join,
			{
				channel: request.streamId
			},
			`conversations.join`
		);

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const streamResponse = await this.getStream({ streamId: request.streamId });
		const streams = await Container.instance().streams.resolve({
			type: MessageType.Streams,
			data: [streamResponse.stream]
		});

		return { stream: streams[0] as CSChannelStream };
	}

	@log()
	async leaveStream(request: LeaveStreamRequest) {
		const cc = Logger.getCorrelationContext();

		// Get a copy of the original stream & copy its membership array (since it will be mutated)
		const originalStream = { ...(await Container.instance().streams.getById(request.streamId)) };
		if (originalStream.memberIds != null) {
			originalStream.memberIds = originalStream.memberIds.slice(0);
		}

		const response = await this.slackApiCall(
			this._slack.conversations.leave,
			{
				channel: request.streamId
			},
			`conversations.leave`
		);

		const { ok, error, not_in_channel } = response as WebAPICallResult & {
			not_in_channel: boolean;
		};
		if (!ok) throw new Error(error);

		if (not_in_channel) {
			const stream = await Container.instance().streams.getById(request.streamId);
			return { stream: stream! as CSChannelStream };
		}

		try {
			const [stream] = await Container.instance().streams.resolve({
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
		let response = await this.slackApiCall(
			this._slack.conversations.info,
			{
				channel: request.streamId
			},
			`conversations.info`
		);

		const { ok, error, channel: c } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const { postId } = fromSlackPostId(
			request.postId || (c.latest && c.latest.ts),
			request.streamId
		);
		if (postId == null) return {};

		if (c.is_channel) {
			response = await this.slackApiCall(
				this._slack.channels.mark,
				{ channel: c.id, ts: postId },
				`channels.mark`
			);
			return {};
		}

		if (c.is_group) {
			response = await this.slackApiCall(
				this._slack.groups.mark,
				{ channel: c.id, ts: postId },
				`groups.mark`
			);
			return {};
		}

		if (c.is_im) {
			response = await this.slackApiCall(
				this._slack.im.mark,
				{ channel: c.id, ts: postId },
				`im.mark`
			);
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

		const response = await this.slackApiCall(
			this._slack.conversations.open,
			{
				channel: request.streamId,
				return_im: true
			},
			`conversations.open`
		);

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		try {
			const members = await this.getStreamMembers(channel.id);
			channel.members = members;
		} catch (ex) {
			Logger.error(ex, cc);

			const stream = await Container.instance().streams.getById(request.streamId);
			channel.members = stream.memberIds;
		}

		const stream = fromSlackChannelOrDirect(
			channel,
			await this.ensureUsernamesById(),
			this._slackUserId,
			this._codestreamTeamId
		)!;

		const streams = await Container.instance().streams.resolve({
			type: MessageType.Streams,
			data: [stream]
		});

		return { stream: streams[0] as CSDirectStream };
	}

	@log()
	async renameStream(request: RenameStreamRequest) {
		const response = await this.slackApiCall(
			this._slack.conversations.rename,
			{
				channel: request.streamId,
				name: request.name
			},
			`conversations.rename`
		);

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const streamResponse = await this.getStream({ streamId: request.streamId });
		const streams = await Container.instance().streams.resolve({
			type: MessageType.Streams,
			data: [streamResponse.stream]
		});

		return { stream: streams[0] as CSChannelStream };
	}

	@log()
	async setStreamPurpose(request: SetStreamPurposeRequest) {
		const response = await this.slackApiCall(
			this._slack.conversations.setPurpose,
			{
				channel: request.streamId,
				purpose: request.purpose
			},
			`conversations.setPurpose`
		);

		const { ok, error, purpose } = response as WebAPICallResult & { purpose: any };
		if (!ok) throw new Error(error);

		const streamResponse = await this.getStream({ streamId: request.streamId });
		const streams = await Container.instance().streams.resolve({
			type: MessageType.Streams,
			data: [streamResponse.stream]
		});

		return { stream: streams[0] as CSChannelStream };
	}

	@log()
	async unarchiveStream(request: UnarchiveStreamRequest) {
		const response = await this.slackApiCall(
			this._slack.conversations.unarchive,
			{
				channel: request.streamId
			},
			`conversations.unarchive`
		);

		const { ok, error } = response as WebAPICallResult;
		if (!ok) throw new Error(error);

		const streamResponse = await this.getStream({ streamId: request.streamId });
		const streams = await Container.instance().streams.resolve({
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
			const response = await this.slackApiCall(
				this._slack.conversations.invite,
				{
					channel: request.streamId,
					users: request.add.join(",")
				},
				`conversations.invite`
			);

			const { ok, error } = response as WebAPICallResult;
			if (!ok) {
				errors.push(error);
			}
		}

		if (request.remove != null && request.remove.length !== 0) {
			for (const userId of request.remove) {
				const response = await this.slackApiCall(
					this._slack.conversations.kick,
					{
						channel: request.streamId,
						user: userId
					},
					`conversations.kick`
				);

				const { ok, error } = response as WebAPICallResult;
				if (!ok) {
					errors.push(error);
				}
			}
		}

		if (errors.length !== 0) throw new Error(errors.join(", "));

		const streamResponse = await this.getStream({ streamId: request.streamId });
		const streams = await Container.instance().streams.resolve({
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

	@log()
	async fetchUsers(request: FetchUsersRequest) {
		const response = await this.slackApiCall(this._slack.users.list, undefined, `users.list`);

		const { ok, error, members } = response as WebAPICallResult & { members: any[] };
		if (!ok) throw new Error(error);

		const users: CSUser[] = members
			.map((m: any) => fromSlackUser(m, this._codestreamTeamId))
			.filter(u => !u.deactivated);

		// Find ourselves and replace it with our model
		const index = users.findIndex(u => u.id === this._slackUserId);

		const meResponse = await this.getMeCore();
		users.splice(index, 1, meResponse.user);

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

		const response = await this.slackApiCall(
			this._slack.users.info,
			{
				user: request.userId
			},
			"users.info"
		);

		const { ok, error, user: usr } = response as WebAPICallResult & { user: any };
		if (!ok) throw new Error(error);

		const user = fromSlackUser(usr, this._codestreamTeamId);

		return { user: user };
	}

	@log()
	inviteUser(request: InviteUserRequest) {
		return this._codestream.inviteUser(request);
	}

	protected async slackApiCall<TRequest, TResponse extends WebAPICallResult>(
		fn: (request?: TRequest) => Promise<TResponse>,
		request?: TRequest,
		name?: string
	): Promise<TResponse>;
	protected async slackApiCall<TRequest, TResponse extends WebAPICallResult>(
		method: string,
		request?: TRequest,
		name?: string
	): Promise<TResponse>;
	@debug({
		args: false,
		prefix: (context, fnOrMethod, request, name) =>
			`${context.prefix} ${name ||
				(typeof fnOrMethod === "string" ? fnOrMethod : Logger.toLoggableName(fnOrMethod))}(${
				request != null
					? Logger.toLoggable(request, (key, value) =>
							logFilterKeys.has(key) ? `<${key}>` : value
					  )
					: ""
			})`
	})
	protected async slackApiCall<TRequest, TResponse extends WebAPICallResult>(
		fnOrMethod: ((request?: TRequest) => Promise<TResponse>) | string,
		request?: TRequest,
		name?: string
	): Promise<TResponse> {
		const cc = Logger.getCorrelationContext();

		const timeoutMs = 30000;
		try {
			const response = await Functions.timeout(
				typeof fnOrMethod === "string"
					? this._slack.apiCall(fnOrMethod, request)
					: fnOrMethod(request),
				timeoutMs,
				{
					message: cc && cc.prefix,
					onTimeout: (resolve, reject, message) => {
						const telemetry = Container.instance().telemetry;
						telemetry.track({
							eventName: "Slack Timeout",
							properties: {
								Message: message || "N/A"
							}
						});
						Logger.warn(cc, `TIMEOUT ${timeoutMs / 1000}s exceeded`);
					}
				}
			);
			if (Container.instance().session.recordRequests) {
				const method = typeof fnOrMethod === "string" ? fnOrMethod : name;
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

	async dispose() {
		await this._codestream.dispose();
		if (this._events) {
			await this._events.dispose();
		}
	}
}

const logFilterKeys = new Set(["text", "attachments"]);
