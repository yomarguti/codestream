"use strict";
import { LogLevel, WebAPICallResult, WebClient } from "@slack/client";
import { RequestInit } from "node-fetch";
import { Emitter, Event } from "vscode-languageserver";
import { Container } from "../../container";
import { Logger, TraceLevel } from "../../logger";
import {
	CreateChannelStreamRequest,
	CreateDirectStreamRequest,
	CreateDirectStreamResponse,
	CreateMarkerLocationRequest,
	CreatePostRequest,
	CreateRepoRequest,
	CSUnreads,
	DeletePostRequest,
	EditPostRequest,
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
	GetMarkerRequest,
	GetPostRequest,
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
	ReactToPostRequest,
	UpdateMarkerRequest,
	UpdatePreferencesRequest,
	UpdatePresenceRequest,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse,
	UpdateStreamRequest,
	UpdateStreamResponse
} from "../../shared/agent.protocol";
import {
	CSChannelStream,
	CSCodeBlock,
	CSDirectStream,
	CSGetMeResponse,
	CSMe,
	CSPost,
	CSSlackProviderInfo,
	CSUser,
	LoginResponse,
	StreamType
} from "../../shared/api.protocol";
import { log } from "../../system";
import {
	ApiProvider,
	CodeStreamApiMiddleware,
	ConnectionStatus,
	LoginOptions,
	MessageType,
	RTMessage,
	StreamsRTMessage
} from "../apiProvider";
import { CodeStreamApiProvider } from "../codestream/codestreamApi";
import { SlackEvents } from "./events";
import {
	fromSlackChannel,
	fromSlackChannelIdToType,
	fromSlackChannelOrDirect,
	fromSlackDirect,
	fromSlackPost,
	fromSlackPostId,
	fromSlackUser,
	toSlackPostText,
	toSlackTeam
} from "./slackApi.adapters";
import { SlackUnreads } from "./unreads";

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

	private readonly _unreads: SlackUnreads;
	private _user: CSMe;
	// TODO: Convert to index on UserManager?
	private _usersById: Map<string, CSUser> | undefined;
	// TODO: Convert to index on UserManager?
	private _usersByName: Map<string, CSUser> | undefined;

	constructor(
		private _codestream: CodeStreamApiProvider,
		providerInfo: CSSlackProviderInfo,
		user: CSMe,
		private readonly _codestreamTeamId: string
	) {
		this._slackToken = providerInfo.accessToken;
		this._slack = new WebClient(this._slackToken, {
			logLevel: Logger.level === TraceLevel.Debug ? LogLevel.DEBUG : LogLevel.INFO,
			logger: (level, message) => Logger.log(`SLACK[${level}]: ${message}`)
		});

		this._slack.on("rate_limited", retryAfter => {
			Logger.log(
				`SlackApiProvider request was rate limited and future requests will be paused for ${retryAfter} seconds`
			);
		});

		this._unreads = new SlackUnreads(this);
		this._unreads.onDidChange(this.onUnreadsChanged, this);

		this._codestreamUserId = user.id;
		this._slackUserId = providerInfo.userId;

		this._user = user;
	}

	private async onCodeStreamMessage(e: RTMessage) {
		try {
			Logger.logWithDebugParams(`SlackApiProvider.onCodeStreamMessage(${e.type})`, e);

			switch (e.type) {
				case MessageType.Connection:
					switch (e.data.status) {
						case ConnectionStatus.Disconnected:
							void (await this._events!.disconnect());
							break;
						// case ConnectionStatus.Reconnecting:
						case ConnectionStatus.Reconnected:
							if (!this._events!.connected) {
								void (await this._events!.reconnect());
							}
					}
					break;

				case MessageType.Users:
					// TODO: Map with slack data
					const user = e.data.find(u => u.id === this._codestreamUserId);
					if (user === undefined) return;

					const meResponse = await this.getMe();
					this._onDidReceiveMessage.fire({ type: e.type, data: [meResponse.user] });
					break;

				default:
					this._onDidReceiveMessage.fire(e);
			}
		} catch (ex) {
			Logger.error(ex, `SlackApiProvider.onCodeStreamMessage(${e.type})`);
		}
	}

	private onUnreadsChanged(e: CSUnreads) {
		try {
			this._onDidReceiveMessage.fire({ type: MessageType.Unreads, data: e });
		} catch (ex) {
			Logger.error(ex, "SlackApiProvider.onUnreadsChanged");
		}
	}

	async processLoginResponse(response: LoginResponse): Promise<void> {
		// Mix in slack user info with ours
		const meResponse = await this.getMeCore({ user: this._user });
		this._user = meResponse.user;

		// TODO: Correlate codestream ids to slack ids once the server returns that info
		// const users = await this._codestream.fetchUsers({});
		// users;

		const team = response.teams.find(t => t.id === this._codestreamTeamId);
		if (team !== undefined) {
			toSlackTeam(team, await this.ensureUsersById());
		}

		if (this._user.lastReads == null) {
			this._user.lastReads = {};
		}
		response.user = this._user;
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
		this._events = new SlackEvents(this._slackToken, this);
		this._events.onDidReceiveMessage(e => this._onDidReceiveMessage.fire(e), this);
		await this._events.connect();

		this._codestream.onDidReceiveMessage(this.onCodeStreamMessage, this);
		await this._codestream.subscribe([
			MessageType.Connection,
			MessageType.MarkerLocations,
			MessageType.Markers,
			MessageType.Repositories,
			MessageType.Users
		]);
	}

	async ensureUsersById(): Promise<Map<string, CSUser>> {
		if (this._usersById === undefined) {
			void (await this.ensureUsersByIdAndName());
		}
		return this._usersById!;
	}

	private async ensureUsersByName(): Promise<Map<string, CSUser>> {
		if (this._usersByName === undefined) {
			void (await this.ensureUsersByIdAndName());
		}

		return this._usersByName!;
	}

	private async ensureUsersByIdAndName(): Promise<void> {
		if (this._usersById === undefined || this._usersByName === undefined) {
			const users = (await Container.instance().users.get()).users;

			this._usersById = new Map();
			this._usersByName = new Map();

			for (const user of users) {
				this._usersById.set(user.id, user);
				this._usersByName.set(user.username, user);
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

		const me = meResponse.user;
		me.id = this.userId;

		const response = await this._slack.users.info({
			user: this.userId
		});

		const { ok, error, user: usr } = response as WebAPICallResult & { user: any };
		if (ok) {
			const user = fromSlackUser(usr, this._codestreamTeamId);
			return {
				user: {
					...me,
					avatar: user.avatar,
					// creatorId: user.id,
					deactivated: user.deactivated,
					email: user.email || me.email,
					firstName: user.firstName,
					fullName: user.fullName,
					id: user.id,
					lastName: user.lastName,
					username: user.username
				}
			};
		}

		return meResponse;
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
	async createPost(request: CreatePostRequest) {
		try {
			const meMessage = request.text && request.text.startsWith("/me ");

			let text;
			if (request.text) {
				text = toSlackPostText(
					request.text,
					request.mentionedUserIds,
					await this.ensureUsersByName()
				);
			} else {
				text = request.text;
			}

			if (meMessage) {
				const response = await this._slack.chat.meMessage({
					channel: request.streamId,
					text: text
				});

				const { ok, error, ts: postId } = response as WebAPICallResult & { ts?: any };
				if (!ok) throw new Error(error);

				const postResponse = await this.getPost({ streamId: request.streamId, postId: postId });
				return postResponse;
			}

			const { streamId, postId: parentPostId } = fromSlackPostId(
				request.parentPostId,
				request.streamId
			);

			const response = await this._slack.chat.postMessage({
				channel: streamId,
				text: text,
				as_user: true,
				thread_ts: parentPostId,
				unfurl_links: true,
				reply_broadcast: parentPostId ? true : undefined
			});

			// tslint:disable-next-line:prefer-const
			let { ok, error, message } = response as WebAPICallResult & { message?: any; ts?: any };
			if (!ok) throw new Error(error);

			const usersById = await this.ensureUsersById();
			const post = await fromSlackPost(message, streamId, usersById, this._codestreamTeamId);

			if (request.codeBlocks == null || request.codeBlocks.length === 0) {
				return { post: post };
			}

			const [codeblock] = request.codeBlocks;

			const markerResponse = await this._codestream.createMarker({
				providerType: "slack",
				postStreamId: post.streamId,
				postId: post.id,
				streamId: codeblock.streamId,
				file: codeblock.file,
				repoId: codeblock.repoId,
				remotes: codeblock.remotes,
				commitHash: request.commitHashWhenPosted,
				code: codeblock.code,
				location: codeblock.location
				// type: codeblock.type,
				// color: codeblock.color,
				// status: codeblock.status
			});

			const marker = markerResponse.marker;
			// const fileStream = await Container.instance().files.getById(marker.streamId);
			post.codeBlocks = [
				{
					...codeblock,
					// file: fileStream.file,
					// repoId: fileStream.repoId,
					markerId: marker.id
				} as CSCodeBlock
			];

			const [start, , end] = codeblock.location!;
			const title = `${codeblock.file} (Line${start === end ? ` ${start}` : `s ${start}-${end}`})`;

			const githubRemote = codeblock.remotes!.find(r => r.startsWith("github.com"));
			let titleLink;
			if (githubRemote) {
				titleLink = `https://${githubRemote}/blob/HEAD/${codeblock.file}#L${start}${
					start !== end ? `-L${end}` : ""
				}`;
			}

			const code = `\`\`\`${codeblock.code}\`\`\``;

			const attachments = [
				{
					fallback: `${title}\n${code}`,
					title: title,
					title_link: titleLink,
					text: code,
					footer: "Posted via CodeStream",
					ts: (new Date().getTime() / 1000) as any,
					callback_id: `codestream://marker/${marker.id}`
				}
			];

			const { postId } = fromSlackPostId(post.id, post.streamId);

			const updateResponse = await this._slack.chat.update({
				channel: streamId,
				ts: postId,
				text: text,
				as_user: true,
				attachments: attachments
			});

			({ ok, error } = updateResponse as WebAPICallResult);
			if (!ok) throw new Error(error);

			const postResponse = await this.getPost({ streamId: streamId, postId: postId });
			return postResponse;
		} finally {
			this.updatePostsCount();
		}
	}

	private async updatePostsCount() {
		try {
			void (await this._codestream.updatePostsCount({}));
		} catch (ex) {
			debugger;
			Logger.error(ex, "Failed updating post count");
		}
	}

	@log()
	async deletePost(request: DeletePostRequest) {
		const { streamId, postId } = fromSlackPostId(request.postId, request.streamId);
		const postResponse = await this.getPost({ streamId: streamId, postId: postId });

		const response = await this._slack.chat.delete({
			channel: streamId,
			ts: postId,
			as_user: true
		});

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
				await this.ensureUsersByName()
			);
		} else {
			text = request.text;
		}

		const response = await this._slack.chat.update({
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

		// This isn't ideal, but we can always pack some more info into the id to ensure we call the right thing
		switch (fromSlackChannelIdToType(streamId)) {
			case "channel":
				response = await this._slack.channels.replies({
					channel: streamId,
					thread_ts: postId
				});

				break;

			case "group":
				response = await this._slack.groups.replies({
					channel: streamId,
					thread_ts: postId as any // Slack has the wrong typing here
				});

				break;

			case "direct":
				response = await this._slack.im.replies({
					channel: streamId,
					thread_ts: postId
				});
				break;
		}

		const { ok, error, messages } = response as WebAPICallResult & { messages: any };
		// TODO: For now don't throw errors until we deal with marker privacy
		if (!ok) return { posts: [] };
		// if (!ok) throw new Error(error);

		// Ensure the correct ordering
		messages.sort((a: any, b: any) => a.ts - b.ts);

		const usersById = await this.ensureUsersById();
		const posts = await Promise.all(messages.map((m: any) =>
			fromSlackPost(m, streamId, usersById, this._codestreamTeamId)
		) as Promise<CSPost>[]);

		return { posts: posts };
	}

	@log()
	async fetchPosts(request: FetchPostsRequest) {
		let response;

		// This isn't ideal, but we can always pack some more info into the id to ensure we call the right thing
		switch (fromSlackChannelIdToType(request.streamId)) {
			case "channel":
				response = await this._slack.channels.history({
					channel: request.streamId,
					count: request.limit || 100,
					oldest: request.after == null ? undefined : String(request.after),
					latest: request.before == null ? undefined : String(request.before),
					inclusive: request.inclusive
				});

				break;

			case "group":
				response = await this._slack.groups.history({
					channel: request.streamId,
					count: request.limit || 100,
					oldest: request.after == null ? undefined : String(request.after),
					latest: request.before == null ? undefined : String(request.before),
					inclusive: request.inclusive
				});

				break;

			case "direct":
				response = await this._slack.im.history({
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

		const usersById = await this.ensureUsersById();
		const posts = await Promise.all(messages.map((m: any) =>
			fromSlackPost(m, request.streamId, usersById, this._codestreamTeamId)
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
				response = await this._slack.channels.history({
					channel: streamId,
					count: 1,
					latest: postId,
					inclusive: true
				});

				break;

			case "group":
				response = await this._slack.groups.history({
					channel: streamId,
					count: 1,
					latest: postId,
					inclusive: true
				});

				break;

			case "direct":
				response = await this._slack.im.history({
					channel: streamId,
					count: 1,
					latest: postId,
					inclusive: true
				});
				break;
		}

		// Can't use the Conversations API because replies aren't included in the main channel/group/im
		// const response = await this._slack.conversations.history({
		// 	channel: streamId,
		// 	limit: 1,
		// 	inclusive: true,
		// 	latest: postId
		// });

		const { ok, error, messages } = response as WebAPICallResult & { messages: any };
		if (!ok) throw new Error(error);

		const message = messages[0];
		// Since we can end up with a post NEAREST postId rather than postId, make sure we found the right post
		if (message.ts !== postId) throw new Error(`Unable to find message with id=${postId}`);

		const usersById = await this.ensureUsersById();
		const post = await fromSlackPost(message, streamId, usersById, this._codestreamTeamId);

		return { post: post };
	}

	@log()
	async markPostUnread(request: MarkPostUnreadRequest) {
		const { streamId, postId } = fromSlackPostId(request.postId, request.streamId);

		let response;

		// This isn't ideal, but we can always pack some more info into the id to ensure we call the right thing
		switch (fromSlackChannelIdToType(streamId)) {
			case "channel": {
				response = await this._slack.channels.mark({ channel: streamId, ts: postId });
				const { ok, error } = response as WebAPICallResult;
				if (!ok) throw new Error(error);

				break;
			}
			case "group": {
				response = await this._slack.groups.mark({ channel: streamId, ts: postId });
				const { ok, error } = response as WebAPICallResult;
				if (!ok) throw new Error(error);

				break;
			}
			case "direct": {
				response = await this._slack.im.mark({ channel: streamId, ts: postId });
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
				response = await this._slack.reactions.add({
					channel: streamId,
					timestamp: postId,
					name: name
				});
			} else {
				response = await this._slack.reactions.remove({
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
		if (request.isTeamStream || request.memberIds == null || request.memberIds.length === 0) {
			throw new Error("Cannot create team streams on Slack");
		}

		const response = await this._slack.conversations.create({
			name: request.name,
			is_private: request.privacy === "private",
			user_ids: request.memberIds.join(",")
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const stream = fromSlackChannelOrDirect(
			channel,
			await this.ensureUsersById(),
			this._slackUserId,
			this._codestreamTeamId
		);

		return { stream: stream! as CSChannelStream };
	}

	@log()
	async createDirectStream(request: CreateDirectStreamRequest) {
		const response = await this._slack.conversations.open({
			users: request.memberIds.join(","),
			return_im: false
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const streamResponse = await this.getStream({ streamId: channel.id, type: StreamType.Direct });
		return streamResponse as CreateDirectStreamResponse;
	}

	@log({
		correlate: true,
		exit: (r: FetchStreamsResponse) => `\n${r.streams.map(s => `\t${s.id} = ${s.name}`).join("\n")}`
	})
	async fetchStreams(request: FetchStreamsRequest) {
		try {
			// const response = await this._slack.conversations.list({
			// 	exclude_archived: true,
			// 	limit: 1000,
			// 	types: "public_channel,private_channel,mpim,im"
			// });

			// const { ok, error, channels } = response as WebAPICallResult & { channels: any };
			// if (!ok) throw new Error(error);

			// const users = (await this.fetchUsers({})).users;
			// const streams: (CSChannelStream | CSDirectStream)[] = channels
			// 	.map((c: any) => CSStream.fromSlack(c, users, this._slackUserId, this._codestreamTeamId))
			// 	.filter(Boolean);

			this._unreads.reset();

			const usersById = await this.ensureUsersById();

			const [
				[channels, channelRequests],
				[groups, groupRequests],
				[ims, imRequests]
			] = await Promise.all([
				this.fetchChannels(),
				this.fetchGroups(usersById),
				this.fetchIMs(usersById)
			]);

			const streams = channels.concat(...groups, ...ims);

			const pendingStreamRequests = channelRequests.concat(...groupRequests, ...imRequests);

			const logCorrelationId = (this.fetchStreams as any).logCorrelationId;
			const prefix = `${
				logCorrelationId ? `[${logCorrelationId}] ` : ""
			}SlackApiProvider.fetchStreams`;
			Logger.debug(
				`${prefix}: fetching ${pendingStreamRequests.length} stream(s) in the background...`
			);

			let timedout = false;
			const promises = Promise.all(pendingStreamRequests).then(async streams => {
				if (timedout) {
					Logger.warn(
						`${prefix}: Completed (AFTER TIMEOUT) while fetching ${
							pendingStreamRequests.length
						} stream(s) in the background`
					);
				} else {
					Logger.debug(
						`${prefix}: Completed fetching ${
							pendingStreamRequests.length
						} stream(s) in the background`
					);

					// Only resume if we haven't timed out, since we would have already resumed
					this._unreads.resume();
				}

				const message: StreamsRTMessage = { type: MessageType.Streams, data: streams };
				message.data = await Container.instance().streams.resolve(message);
				this._onDidReceiveMessage.fire(message);
			});

			const pendingRequestsTimeoutMs = 120000;
			Promise.race([
				promises,
				new Promise((resolve, reject) => setTimeout(resolve, pendingRequestsTimeoutMs, "timeout"))
			]).then(v => {
				if (v === "timeout") {
					Logger.warn(
						`${prefix}: TIMEOUT ${pendingRequestsTimeoutMs / 1000}s exceeded while fetching ${
							pendingStreamRequests.length
						} stream(s) in the background`
					);
					timedout = true;

					this._unreads.resume();
				}
			});

			if (
				request.types != null &&
				request.types.length !== 0 &&
				(!request.types.includes(StreamType.Channel) || !request.types.includes(StreamType.Direct))
			) {
				return { streams: streams.filter(s => request.types!.includes(s.type)) };
			}

			return { streams: streams };
		} catch (ex) {
			Logger.error(ex);
			throw ex;
		}
	}

	private async fetchChannels(): Promise<
		[(CSChannelStream | CSDirectStream)[], Promise<CSChannelStream | CSDirectStream>[]]
	> {
		const response = await this._slack.channels.list({
			exclude_archived: true,
			exclude_members: false
			// limit: 1000
		});

		const { ok, error, channels } = response as WebAPICallResult & { channels: any };
		if (!ok) throw new Error(error);

		const streams: (CSChannelStream | CSDirectStream)[] = channels
			.map((c: any) => fromSlackChannel(c, this._codestreamTeamId))
			.filter(Boolean);

		const infos: Promise<CSChannelStream | CSDirectStream>[] = channels
			.map((c: any) => (c.is_archived || !c.is_member ? undefined : this.fetchChannel(c)))
			.filter(Boolean);

		return [streams, infos];
	}

	@log({
		args: false,
		prefix: (context, c) => `${context.prefix}(${c.id})`,
		enter: c => `fetching channel '${c.name}'...`
	})
	private async fetchChannel(c: any) {
		try {
			const response = await this._slack.channels.info({
				channel: c.id
			});

			const { ok, error, channel } = response as WebAPICallResult & { channel: any };
			if (!ok) throw new Error(error);

			this._unreads.update(channel.id, channel.last_read, 0, channel.unread_count_display || 0);

			return fromSlackChannel(channel, this._codestreamTeamId);
		} catch (ex) {
			Logger.error(ex);
			return fromSlackChannel(c, this._codestreamTeamId);
		}
	}

	private async fetchGroups(
		usersById: Map<string, CSUser>
	): Promise<[(CSChannelStream | CSDirectStream)[], Promise<CSChannelStream | CSDirectStream>[]]> {
		const response = await this._slack.groups.list({
			exclude_archived: true,
			exclude_members: false
			// limit: 1000
		});

		const { ok, error, groups } = response as WebAPICallResult & { groups: any };
		if (!ok) throw new Error(error);

		const streams: (CSChannelStream | CSDirectStream)[] = groups
			.map((c: any) =>
				fromSlackChannelOrDirect(c, usersById, this._slackUserId, this._codestreamTeamId)
			)
			.filter(Boolean);

		const infos: Promise<CSChannelStream | CSDirectStream>[] = groups
			.map((g: any) => (g.is_archived ? undefined : this.fetchGroup(g, usersById)))
			.filter(Boolean);

		return [streams, infos];
	}

	@log({
		args: false,
		prefix: (context, g) => `${context.prefix}(${g.id})`,
		enter: g => `fetching ${g.is_mpim ? "mpim" : "group"} '${g.name}'...`
	})
	private async fetchGroup(g: any, usersById: Map<string, CSUser>) {
		try {
			const response = await this._slack.groups.info({
				channel: g.id
			});

			const { ok, error, group } = response as WebAPICallResult & { group: any };
			if (!ok) throw new Error(error);

			this._unreads.update(
				group.id,
				group.last_read,
				group.is_mpim ? group.unread_count_display || 0 : 0,
				group.unread_count_display || 0
			);

			return fromSlackChannelOrDirect(group, usersById, this._slackUserId, this._codestreamTeamId)!;
		} catch (ex) {
			Logger.error(ex);
			return fromSlackChannelOrDirect(g, usersById, this._slackUserId, this._codestreamTeamId)!;
		}
	}

	private async fetchIMs(
		usersById: Map<string, CSUser>
	): Promise<[(CSChannelStream | CSDirectStream)[], Promise<CSChannelStream | CSDirectStream>[]]> {
		const response = await this._slack.im.list({
			exclude_archived: true,
			exclude_members: false
			// limit: 1000
		});

		const { ok, error, ims } = response as WebAPICallResult & { ims: any };
		if (!ok) throw new Error(error);

		const streams: (CSChannelStream | CSDirectStream)[] = ims
			.map((c: any) => fromSlackDirect(c, usersById, this._slackUserId, this._codestreamTeamId))
			.filter(Boolean);

		const infos: Promise<CSChannelStream | CSDirectStream>[] = ims
			.map((im: any) => (im.is_user_deleted ? undefined : this.fetchIM(im, usersById)))
			.filter(Boolean);

		return [streams, infos];
	}

	@log({
		args: false,
		prefix: (context, im) => `${context.prefix}(${im.id})`,
		enter: im => `fetching im with '${im.user}'...`
	})
	private async fetchIM(im: any, usersById: Map<string, CSUser>) {
		try {
			const response = await this._slack.conversations.info({
				channel: im.id
			});

			const { ok, error, channel } = response as WebAPICallResult & { channel: any };
			if (!ok) throw new Error(error);

			this._unreads.update(
				channel.id,
				channel.last_read,
				channel.unread_count_display || 0,
				channel.unread_count_display || 0
			);

			return fromSlackDirect(
				{ ...im, ...channel },
				usersById,
				this._slackUserId,
				this._codestreamTeamId
			);
		} catch (ex) {
			Logger.error(ex);
			return fromSlackDirect(im, usersById, this._slackUserId, this._codestreamTeamId);
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

		let response;
		switch (fromSlackChannelIdToType(request.streamId)) {
			case "channel": {
				response = await this._slack.channels.info({
					channel: request.streamId
				});

				const { ok, error, channel } = response as WebAPICallResult & { channel: any };
				if (!ok) throw new Error(error);

				const stream = fromSlackChannel(channel, this._codestreamTeamId);

				return { stream: stream! };
			}
			case "group": {
				response = await this._slack.groups.info({
					channel: request.streamId
				});

				const { ok, error, group } = response as WebAPICallResult & { group: any };
				if (!ok) throw new Error(error);

				const stream = fromSlackChannelOrDirect(
					group,
					await this.ensureUsersById(),
					this._slackUserId,
					this._codestreamTeamId
				);

				return { stream: stream! };
			}
			case "direct": {
				response = await this._slack.conversations.info({
					channel: request.streamId
				});

				const { ok, error, channel } = response as WebAPICallResult & { channel: any };
				if (!ok) throw new Error(error);

				const stream = fromSlackDirect(
					channel,
					await this.ensureUsersById(),
					this._slackUserId,
					this._codestreamTeamId
				);

				return { stream: stream! };
			}
			default:
				throw new Error(`Invalid stream type: ${request.streamId}`);
		}
	}

	@log()
	private async getStreamMembers(streamId: string) {
		const response = await this._slack.conversations.members({
			channel: streamId
			// limit: 1000
		});

		const { ok, error, members } = response as WebAPICallResult & { members: any };
		if (!ok) throw new Error(error);

		return members;
	}

	@log()
	async joinStream(request: JoinStreamRequest) {
		const response = await this._slack.conversations.join({
			channel: request.streamId
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const stream = fromSlackChannelOrDirect(
			channel,
			await this.ensureUsersById(),
			this._slackUserId,
			this._codestreamTeamId
		);

		return { stream: stream! };
	}

	@log()
	async leaveStream(request: LeaveStreamRequest) {
		const response = await this._slack.conversations.leave({
			channel: request.streamId
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const stream = await this.getStream({ streamId: request.streamId })!;

		return stream!;
	}

	@log()
	async markStreamRead(request: MarkStreamReadRequest) {
		let response = await this._slack.conversations.info({
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
			response = await this._slack.channels.mark({ channel: c.id, ts: postId });
			return {};
		}

		if (c.is_group) {
			response = await this._slack.groups.mark({ channel: c.id, ts: postId });
			return {};
		}

		if (c.is_im) {
			response = await this._slack.im.mark({ channel: c.id, ts: postId });
			return {};
		}

		return {};
	}

	@log()
	async updateStream(request: UpdateStreamRequest): Promise<UpdateStreamResponse> {
		throw new Error("Method not implemented.");
	}

	@log()
	updateStreamMembership(
		request: UpdateStreamMembershipRequest
	): Promise<UpdateStreamMembershipResponse> {
		throw new Error("Method not implemented.");
	}

	@log()
	async fetchTeams(request: FetchTeamsRequest) {
		const response = await this._codestream.fetchTeams(request);

		// Replace the current team's ids with slack ids
		const team = response.teams.find(t => t.id === this._codestreamTeamId);
		if (team !== undefined) {
			toSlackTeam(team, await this.ensureUsersById());
		}

		return response;
	}

	@log()
	async getTeam(request: GetTeamRequest) {
		const response = await this._codestream.getTeam(request);

		// Replace the current team's ids with slack ids
		if (response.team != null && response.team.id === this._codestreamTeamId) {
			toSlackTeam(response.team, await this.ensureUsersById());
		}

		return response;
	}

	@log()
	async fetchUsers(request: FetchUsersRequest) {
		const response = await this._slack.users.list();

		const { ok, error, members } = response as WebAPICallResult & { members: any };
		if (!ok) throw new Error(error);

		const users: CSUser[] = members.map((m: any) => fromSlackUser(m, this._codestreamTeamId));

		// Find ourselves and replace it with our model
		const index = users.findIndex(u => u.id === this._user.id);
		users.splice(index, 1, this._user);

		return { users: users };
	}

	@log()
	async getUser(request: GetUserRequest) {
		if (request.userId === this.userId) {
			return this.getMe();
		}

		// HACK: Forward to CodeStream if this isn't a slack user id
		if (!request.userId.startsWith("U")) {
			return this._codestream.getUser(request);
		}

		const response = await this._slack.users.info({
			user: request.userId
		});

		const { ok, error, user: usr } = response as WebAPICallResult & { user: any };
		if (!ok) throw new Error(error);

		const user = fromSlackUser(usr, this._codestreamTeamId);

		return { user: user };
	}

	@log()
	inviteUser(request: InviteUserRequest) {
		return this._codestream.inviteUser(request);
	}
}
