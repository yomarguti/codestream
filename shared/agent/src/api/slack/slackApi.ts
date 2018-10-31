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
	CreateChannelStreamRequest,
	CreateDirectStreamRequest,
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
	SetStreamPurposeRequest,
	UnarchiveStreamRequest,
	UpdateMarkerRequest,
	UpdatePreferencesRequest,
	UpdatePresenceRequest,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse
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
	// TODO: Convert to index on UserManager?
	private _usernamesById: Map<string, string> | undefined;
	// TODO: Convert to index on UserManager?
	private _userIdsByName: Map<string, string> | undefined;
	private _preferences: CodeStreamPreferences;

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
		this._slack = new WebClient(this._slackToken, {
			agent: this._proxyAgent,
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

		this._preferences = new CodeStreamPreferences(user.preferences);

		this._codestreamUserId = user.id;
		this._slackUserId = providerInfo.userId;
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
		// Make sure to not use the previous state here (it will cause a loop)
		const meResponse = await this.getMeCore(false, { user: response.user });

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
			const response = await this._slack.apiCall("users.prefs.get");

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
		this._events = new SlackEvents(this._slackToken, this, this._proxyAgent);
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
			MessageType.Connection,
			MessageType.MarkerLocations,
			MessageType.Markers,
			// TODO: I think we need to subscribe to these
			// MessageType.Preferences,
			MessageType.Repositories,
			MessageType.Users
		]);
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
		return this.getMeCore(true);
	}

	private async getMeCore(usePrevious: boolean, meResponse?: CSGetMeResponse) {
		if (meResponse === undefined) {
			meResponse = await this._codestream.getMe();
		}

		let prevMe;
		if (usePrevious) {
			prevMe = (await Container.instance().users.getById(this._slackUserId)) as CSMe;
		}

		let me = meResponse.user;
		me.id = this.userId;

		const response = await this._slack.users.info({
			user: this.userId
		});

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
					await this.ensureUserIdsByName()
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

			const usernamesById = await this.ensureUsernamesById();
			const post = await fromSlackPost(message, streamId, usernamesById, this._codestreamTeamId);

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
				await this.ensureUserIdsByName()
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

		const usernamesById = await this.ensureUsernamesById();
		const posts = await Promise.all(messages.map((m: any) =>
			fromSlackPost(m, streamId, usernamesById, this._codestreamTeamId)
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

		const usernamesById = await this.ensureUsernamesById();
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
		if (request.isTeamStream || request.memberIds == null) {
			throw new Error("Cannot create team streams on Slack");
		}

		// Remove ourselves from the membership list
		const index = request.memberIds.findIndex(m => m === this._slackUserId);
		if (index !== -1) {
			request.memberIds.splice(index, 1);
		}

		const response = await this._slack.conversations.create({
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

		const streams = await Container.instance().streams.resolve({
			type: MessageType.Streams,
			data: [stream]
		});

		return { stream: streams[0] as CSChannelStream };
	}

	@log()
	async createDirectStream(request: CreateDirectStreamRequest) {
		const response = await this._slack.conversations.open({
			users: request.memberIds.join(","),
			return_im: true
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		try {
			const members = await this.getStreamMembers(channel.id);
			channel.members = members;
		} catch (ex) {
			Logger.error(ex);

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

			const usernamesById = await this.ensureUsernamesById();

			const pendingRequestsQueue: DeferredStreamRequest<CSChannelStream | CSDirectStream>[] = [];
			const [channels, groups, ims] = await Promise.all([
				this.fetchChannels(pendingRequestsQueue),
				this.fetchGroups(usernamesById, pendingRequestsQueue),
				this.fetchIMs(usernamesById, pendingRequestsQueue)
			]);

			const streams = channels.concat(...groups, ...ims);

			this.processPendingStreamsQueue(pendingRequestsQueue);

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

	@log()
	async getPreferences(): Promise<GetPreferencesResponse> {
		return {
			preferences: this._preferences.get()
		};
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
	private async processPendingStreamsQueue(
		queue: DeferredStreamRequest<CSChannelStream | CSDirectStream>[]
	) {
		queue.sort((a, b) => b.grouping - a.grouping || a.order - b.order);

		const { streams } = Container.instance();

		const logCorrelationId = (this.processPendingStreamsQueue as any).logCorrelationId;
		const prefix = `${
			logCorrelationId ? `[${logCorrelationId}] ` : ""
		}SlackApiProvider.processPendingStreamsQueue`;

		const notifyThrottle = 2000;
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
						`${prefix}: TIMEOUT ${timeoutMs / 1000}s exceeded while fetching stream '${
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
			Logger.debug(`${prefix}: Failed fetching ${failed} stream(s) in the background`);
		}
	}

	private async fetchChannels(
		pendingQueue: DeferredStreamRequest<CSChannelStream | CSDirectStream>[]
	): Promise<(CSChannelStream | CSDirectStream)[]> {
		const response = await this._slack.channels.list({
			exclude_archived: true,
			exclude_members: false
			// limit: 1000
		});

		const { ok, error, channels } = response as WebAPICallResult & { channels: any[] };
		if (!ok) throw new Error(error);

		const streams = [];
		const pending = [];
		for (const c of channels) {
			const s = fromSlackChannel(c, this._codestreamTeamId);
			if (s !== undefined) {
				streams.push(s);
			}

			if (!c.is_archived && c.is_member) {
				pending.push({
					action: () => this.fetchChannel(c.id),
					id: c.id,
					name: c.name as string
				});
			}
		}

		pending.sort((a, b) => a.name.localeCompare(b.name));

		const index = 0;
		for (const p of pending) {
			pendingQueue.push({ action: p.action, grouping: 10, order: index, stream: { id: p.id } });
		}

		return streams;
	}

	@log({
		args: false,
		prefix: (context, id) => `${context.prefix}(${id})`
	})
	private async fetchChannel(id: string) {
		try {
			const response = await this._slack.channels.info({
				channel: id
			});

			const { ok, error, channel } = response as WebAPICallResult & { channel: any };
			if (!ok) throw new Error(error);

			this._unreads.update(channel.id, channel.last_read, 0, channel.unread_count_display || 0);

			return fromSlackChannel(channel, this._codestreamTeamId);
		} catch (ex) {
			Logger.error(ex);
			throw ex;
		}
	}

	private async fetchGroups(
		usernamesById: Map<string, string>,
		pendingQueue: DeferredStreamRequest<CSChannelStream | CSDirectStream>[]
	): Promise<(CSChannelStream | CSDirectStream)[]> {
		const response = await this._slack.groups.list({
			exclude_archived: true,
			exclude_members: false
			// limit: 1000
		});

		const { ok, error, groups } = response as WebAPICallResult & { groups: any[] };
		if (!ok) throw new Error(error);

		const streams = [];
		const pending = [];
		for (const g of groups) {
			const s = fromSlackChannelOrDirect(
				g,
				usernamesById,
				this._slackUserId,
				this._codestreamTeamId
			);
			if (s !== undefined) {
				streams.push(s);
			}

			if (!g.is_archived) {
				pending.push({
					action: () => this.fetchGroup(g.id, usernamesById),
					grouping: g.is_mpim ? 1 : 5,
					id: g.id,
					priority: (g.priority || 0) as number
				});
			}
		}

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

		return streams;
	}

	@log({
		args: false,
		prefix: (context, id) => `${context.prefix}(${id})`
	})
	private async fetchGroup(id: any, usernamesById: Map<string, string>) {
		try {
			const response = await this._slack.groups.info({
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
			Logger.error(ex);
			throw ex;
		}
	}

	private async fetchIMs(
		usernamesById: Map<string, string>,
		pendingQueue: DeferredStreamRequest<CSChannelStream | CSDirectStream>[]
	): Promise<(CSChannelStream | CSDirectStream)[]> {
		const response = await this._slack.im.list({
			// limit: 1000
		});

		const { ok, error, ims } = response as WebAPICallResult & { ims: any[] };
		if (!ok) throw new Error(error);

		const streams = [];
		const pending = [];
		for (const im of ims) {
			const s = fromSlackDirect(im, usernamesById, this._slackUserId, this._codestreamTeamId);
			if (s !== undefined) {
				streams.push(s);
			}

			if (!im.is_user_deleted) {
				pending.push({
					action: () => this.fetchIM(im.id, usernamesById),
					id: im.id,
					priority: (im.priority || 0) as number
				});
			}
		}

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

		return streams;
	}

	@log({
		args: false,
		prefix: (context, id) => `${context.prefix}(${id})`
	})
	private async fetchIM(id: string, usernamesById: Map<string, string>) {
		try {
			const response = await this._slack.conversations.info({
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
			Logger.error(ex);
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
		const response = await this._slack.conversations.members({
			channel: streamId
			// limit: 1000
		});

		const { ok, error, members } = response as WebAPICallResult & { members: string[] };
		if (!ok) throw new Error(error);

		return members;
	}

	@log()
	async archiveStream(request: ArchiveStreamRequest) {
		const response = await this._slack.conversations.archive({
			channel: request.streamId
		});

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
		const response = await this._slack.conversations.close({
			channel: request.streamId
		});

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
		const response = await this._slack.conversations.join({
			channel: request.streamId
		});

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
		// Get a copy of the original stream & copy its membership array (since it will be mutated)
		const originalStream = { ...(await Container.instance().streams.getById(request.streamId)) };
		if (originalStream.memberIds != null) {
			originalStream.memberIds = originalStream.memberIds.slice(0);
		}

		const response = await this._slack.conversations.leave({
			channel: request.streamId
		});

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
						$pull: { memberIds: [this._slackUserId] }
					}
				]
			});
			return { stream: stream as CSChannelStream };
		} catch (ex) {
			Logger.error(ex);

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
	async muteStream(request: MuteStreamRequest): Promise<MuteStreamResponse> {
		throw new Error("Method not implemented.");
	}

	@log()
	async openStream(request: OpenStreamRequest) {
		const response = await this._slack.conversations.open({
			channel: request.streamId,
			return_im: true
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		try {
			const members = await this.getStreamMembers(channel.id);
			channel.members = members;
		} catch (ex) {
			Logger.error(ex);

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
		const response = await this._slack.conversations.rename({
			channel: request.streamId,
			name: request.name
		});

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
		const response = await this._slack.conversations.setPurpose({
			channel: request.streamId,
			purpose: request.purpose
		});

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
		const response = await this._slack.conversations.unarchive({
			channel: request.streamId
		});

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
			const response = await this._slack.conversations.invite({
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
				const response = await this._slack.conversations.kick({
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
		const response = await this._slack.users.list();

		const { ok, error, members } = response as WebAPICallResult & { members: any };
		if (!ok) throw new Error(error);

		const users: CSUser[] = members.map((m: any) => fromSlackUser(m, this._codestreamTeamId));

		// Find ourselves and replace it with our model
		const index = users.findIndex(u => u.id === this._slackUserId);

		// Make sure to not use the previous state here (it will cause a loop)
		const meResponse = await this.getMeCore(false);
		users.splice(index, 1, meResponse.user);

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
