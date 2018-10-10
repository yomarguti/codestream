"use strict";
import {
	RTMClient,
	RTMClientOptions,
	WebAPICallResult,
	WebClient,
	WebClientOptions
} from "@slack/client";
import { RequestInit } from "node-fetch";
import { Emitter, Event } from "vscode-languageserver";
import { Logger } from "../logger";
import {
	CreateChannelStreamRequest,
	CreateDirectStreamRequest,
	CreateDirectStreamResponse,
	CreateMarkerLocationRequest,
	CreatePostRequest,
	CreateRepoRequest,
	DeletePostRequest,
	EditPostRequest,
	FetchFileStreamsRequest,
	FetchMarkerLocationsRequest,
	FetchMarkersRequest,
	FetchPostRepliesRequest,
	FetchPostsRequest,
	FetchStreamsRequest,
	FetchTeamsRequest,
	FetchUnreadStreamsRequest,
	FetchUsersRequest,
	FindRepoRequest,
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
	MessageType,
	ReactToPostRequest,
	UpdateMarkerRequest,
	UpdatePreferencesRequest,
	UpdatePresenceRequest,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse,
	UpdateStreamRequest,
	UpdateStreamResponse
} from "../shared/agent.protocol";
import {
	CSChannelStream,
	CSCodeBlock,
	CSDirectStream,
	CSGetMeResponse,
	CSMe,
	CSPost,
	CSSlackProviderInfo,
	CSStream,
	CSUser,
	LoginResponse,
	StreamType
} from "../shared/api.protocol";
import { ApiProvider, CodeStreamApiMiddleware, LoginOptions, RTMessage } from "./apiProvider";
import { CodeStreamApiProvider } from "./codestreamApi";
import {
	fromSlackChannel,
	fromSlackChannelOrDirect,
	fromSlackDirect,
	fromSlackPost,
	fromSlackPostId,
	fromSlackUser,
	toSlackPostText,
	toSlackTeam
} from "./slackApi.adapters";

enum SlackEventTypes {
	Authenticated = "authenticated",
	ChannelMarked = "channel_marked",
	GroupMarked = "group_marked",
	ImMarked = "im_marked",
	Message = "message",
	UnableToStart = "unable_to_rtm_start",
	ReactionAdded = "reaction_added",
	ReactionRemoved = "reaction_removed"
}

enum SlackMessageEventSubTypes {
	Changed = "message_changed",
	Deleted = "message_deleted",
	Replied = "message_replied"
}

export class SlackApiProvider implements ApiProvider {
	private _onDidReceiveMessage = new Emitter<RTMessage>();
	get onDidReceiveMessage(): Event<RTMessage> {
		return this._onDidReceiveMessage.event;
	}

	private _slack: WebClient;
	private _slackRTM: RTMClient;

	private readonly _codestreamUserId: string;
	private readonly _slackToken: string;
	private readonly _slackUserId: string;

	private _streams: (CSChannelStream | CSDirectStream)[] | undefined;
	private _user: CSMe;
	private _users: CSUser[] | undefined;
	private _usersById: Map<string, CSUser> | undefined;
	private _usersByName: Map<string, CSUser> | undefined;

	constructor(
		private _codestream: CodeStreamApiProvider,
		providerInfo: CSSlackProviderInfo,
		user: CSMe,
		private readonly _codestreamTeamId: string
	) {
		this._slackToken = providerInfo.accessToken;
		const slackOptions: WebClientOptions = { retryConfig: { retries: 3 } };
		this._slack = new WebClient(this._slackToken, slackOptions);

		const rtmOptions: RTMClientOptions = { retryConfig: { retries: 3 } };
		this._slackRTM = new RTMClient(this._slackToken, rtmOptions);

		this._codestreamUserId = user.id;
		this._slackUserId = providerInfo.userId;

		this._user = user;
	}

	private async onCodeStreamMessage(e: RTMessage) {
		switch (e.type) {
			case MessageType.Users:
				// TODO: Map with slack data
				const user = (e.data as CSUser[]).find(u => u.id === this._codestreamUserId);
				if (user === undefined) return;

				const meResponse = await this.getMe();
				this._onDidReceiveMessage.fire({ type: e.type, data: [meResponse.user] });
				break;

			case MessageType.Posts:
			case MessageType.Streams:
			case MessageType.Teams:
				break;

			default:
				this._onDidReceiveMessage.fire(e);
		}
	}

	private async onSlackMessage(
		e: any & { type: SlackEventTypes; subtype: SlackMessageEventSubTypes }
	) {
		const { type, subtype } = e;

		switch (type) {
			case SlackEventTypes.Message:
				switch (subtype) {
					case SlackMessageEventSubTypes.Deleted: {
						const post = await fromSlackPost(
							e.previous_message,
							e.channel,
							this._usersById || new Map(),
							this._codestreamTeamId
						);
						post.deactivated = true;
						this._onDidReceiveMessage.fire({
							type: MessageType.Posts,
							data: [post]
						});
						break;
					}
					case SlackMessageEventSubTypes.Changed: {
						const response = await this.getPost({ streamId: e.channel, postId: e.message.ts });
						this._onDidReceiveMessage.fire({
							type: MessageType.Posts,
							data: [response.post]
						});

						// const post = CSPost.fromSlack(
						// 	e.message,
						// 	e.channel,
						// 	this._usersById || new Map(),
						// 	this._codestreamTeamId
						// );
						// this._onDidReceiveMessage.fire({
						// 	type: MessageType.Posts,
						// 	data: [post]
						// });
						break;
					}
					default: {
						// Don't trust the payload, since it might not be a full message
						const response = await this.getPost({ streamId: e.channel, postId: e.ts });
						this._onDidReceiveMessage.fire({
							type: MessageType.Posts,
							data: [response.post]
						});

						// const post = CSPost.fromSlack(
						// 	e,
						// 	e.channel,
						// 	this._usersById || new Map(),
						// 	this._codestreamTeamId
						// );
						// this._onDidReceiveMessage.fire({
						// 	type: MessageType.Posts,
						// 	data: [post]
						// });
					}
					// const { text, attachments, files, thread_ts, ts } = e;

					// if (!!thread_ts && !!ts && thread_ts !== ts) {
					// 	// This is a thread reply
					// 	const { user, text, channel } = e;
					// 	const reply = {
					// 		userId: user,
					// 		timestamp: ts,
					// 		text
					// 	};
					// 	//   vscode.commands.executeCommand(
					// 	// 	SelfCommands.UPDATE_MESSAGE_REPLIES,
					// 	// 	{
					// 	// 	  parentTimestamp: thread_ts,
					// 	// 	  channelId: channel,
					// 	// 	  reply
					// 	// 	}
					// 	//   );
					// } else {
					// 	const hasAttachment = attachments && attachments.length > 0;
					// 	const hasFiles = files && files.length > 0;

					// 	if (!!text || hasAttachment || hasFiles) {
					// 		// const message = getMessage(event);
					// 		// newMessages = {
					// 		//   ...newMessages,
					// 		//   ...message
					// 		// };
					// 		// this.handleMessageLinks(message);
					// 	}
					// }
				}
				break;
			case SlackEventTypes.ReactionAdded:
			case SlackEventTypes.ReactionRemoved:
				const response = await this.getPost({ streamId: e.item.channel, postId: e.item.ts });
				this._onDidReceiveMessage.fire({
					type: MessageType.Posts,
					data: [response.post]
				});
				break;
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

		response.user = this._user;
	}

	get codestreamUserId(): string {
		return this._codestreamUserId!;
	}

	get slackUserId(): string {
		return this._slackUserId;
	}

	fetch<R extends object>(url: string, init?: RequestInit, token?: string) {
		return this._codestream.fetch<R>(url, init, token);
	}

	useMiddleware(middleware: CodeStreamApiMiddleware) {
		return this._codestream.useMiddleware(middleware);
	}

	async login(options: LoginOptions): Promise<LoginResponse & { teamId: string }> {
		throw new Error("Not supported");
	}

	async subscribe() {
		this._codestream.onDidReceiveMessage(this.onCodeStreamMessage, this);
		await this._codestream.subscribe();

		this._slackRTM.on(SlackEventTypes.Message, this.onSlackMessage, this);
		this._slackRTM.on(SlackEventTypes.ReactionAdded, this.onSlackMessage, this);
		this._slackRTM.on(SlackEventTypes.ReactionRemoved, this.onSlackMessage, this);

		await new Promise((resolve, reject) => {
			this._slackRTM.once(SlackEventTypes.Authenticated, response => {
				const { ok, self, team } = response;
				if (ok) {
					resolve({
						token: this._slackToken,
						id: self.id,
						name: self.name,
						teams: [{ id: team.id, name: team.name }],
						currentTeamId: team.id,
						provider: "slack"
					});
				}
			});

			this._slackRTM.once(SlackEventTypes.UnableToStart, reject);

			this._slackRTM.start();
		});
	}

	private async ensureUsersById(): Promise<Map<string, CSUser>> {
		if (this._usersById === undefined) {
			void (await this.fetchUsers({}));
		}
		return this._usersById!;
	}

	private async ensureUsersByName(): Promise<Map<string, CSUser>> {
		if (this._usersByName === undefined) {
			void (await this.fetchUsers({}));
		}
		return this._usersByName!;
	}

	grantPubNubChannelAccess(token: string, channel: string): Promise<{}> {
		if (channel === `user-${this.slackUserId}`) {
			channel = `user-${this.codestreamUserId}`;
		}

		return this._codestream.grantPubNubChannelAccess(token, channel);
	}

	async getSubscribableStreams(userId: string): Promise<CSStream[]> {
		return [];
	}

	getMe() {
		return this.getMeCore();
	}

	private async getMeCore(meResponse?: CSGetMeResponse) {
		if (meResponse === undefined) {
			meResponse = await this._codestream.getMe();
		}

		const me = meResponse.user;
		me.id = this.slackUserId;

		const response = await this._slack.users.info({
			user: this.slackUserId
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

	async getUnreads(request: GetUnreadsRequest) {
		return {
			lastReads: request.lastReads,
			mentions: {},
			messages: {}
		};
	}

	updatePreferences(request: UpdatePreferencesRequest) {
		return this._codestream.updatePreferences(request);
	}

	updatePresence(request: UpdatePresenceRequest) {
		return this._codestream.updatePresence(request);
	}

	fetchFileStreams(request: FetchFileStreamsRequest) {
		return this._codestream.fetchFileStreams(request);
	}

	createMarkerLocation(request: CreateMarkerLocationRequest) {
		return this._codestream.createMarkerLocation(request);
	}

	fetchMarkerLocations(request: FetchMarkerLocationsRequest) {
		return this._codestream.fetchMarkerLocations(request);
	}

	fetchMarkers(request: FetchMarkersRequest) {
		return this._codestream.fetchMarkers(request);
	}

	getMarker(request: GetMarkerRequest) {
		return this._codestream.getMarker(request);
	}

	updateMarker(request: UpdateMarkerRequest) {
		return this._codestream.updateMarker(request);
	}

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

	async fetchPostReplies(request: FetchPostRepliesRequest) {
		const { streamId, postId } = fromSlackPostId(request.postId, request.streamId);

		let response;

		// This isn't ideal, but we can always pack some more info into the id to ensure we call the right thing
		switch (request.streamId[0]) {
			case "C":
				response = await this._slack.channels.replies({
					channel: streamId,
					thread_ts: postId
				});

				break;

			case "G":
				response = await this._slack.groups.replies({
					channel: streamId,
					thread_ts: postId as any // Slack has the wrong typing here
				});

				break;

			case "D":
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
			fromSlackPost(m, request.streamId, usersById, this._codestreamTeamId)
		) as Promise<CSPost>[]);

		return { posts: posts };
	}

	async fetchPosts(request: FetchPostsRequest) {
		let response;

		// This isn't ideal, but we can always pack some more info into the id to ensure we call the right thing
		switch (request.streamId[0]) {
			case "C":
				response = await this._slack.channels.history({
					channel: request.streamId,
					count: request.limit || 100,
					oldest: request.after == null ? undefined : String(request.after),
					latest: request.before == null ? undefined : String(request.before),
					inclusive: request.inclusive
				});

				break;

			case "G":
				response = await this._slack.groups.history({
					channel: request.streamId,
					count: request.limit || 100,
					oldest: request.after == null ? undefined : String(request.after),
					latest: request.before == null ? undefined : String(request.before),
					inclusive: request.inclusive
				});

				break;

			case "D":
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

	async getPost(request: GetPostRequest) {
		const { streamId, postId } = fromSlackPostId(request.postId, request.streamId);

		const response = await this._slack.conversations.history({
			channel: streamId,
			limit: 1,
			inclusive: true,
			latest: postId
		});

		const { ok, error, messages } = response as WebAPICallResult & { messages: any };
		if (!ok) throw new Error(error);

		const usersById = await this.ensureUsersById();

		const posts = await Promise.all(messages.map((m: any) =>
			fromSlackPost(m, streamId, usersById, this._codestreamTeamId)
		) as Promise<CSPost>[]);

		return { post: posts[0] };
	}

	async markPostUnread(request: MarkPostUnreadRequest) {
		const { streamId, postId } = fromSlackPostId(request.postId, request.streamId);

		let response;

		// This isn't ideal, but we can always pack some more info into the id to ensure we call the right thing
		switch (streamId[0]) {
			case "C": {
				response = await this._slack.channels.mark({ channel: streamId, ts: postId });
				const { ok, error } = response as WebAPICallResult;
				if (!ok) throw new Error(error);

				break;
			}
			case "G": {
				response = await this._slack.groups.mark({ channel: streamId, ts: postId });
				const { ok, error } = response as WebAPICallResult;
				if (!ok) throw new Error(error);

				break;
			}
			case "D": {
				response = await this._slack.im.mark({ channel: streamId, ts: postId });
				const { ok, error } = response as WebAPICallResult;
				if (!ok) throw new Error(error);
				break;
			}
		}

		return this.getPost({ streamId: streamId, postId: postId });
	}

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

	createRepo(request: CreateRepoRequest) {
		return this._codestream.createRepo(request);
	}

	fetchRepos() {
		return this._codestream.fetchRepos();
	}

	findRepo(request: FindRepoRequest) {
		return this._codestream.findRepo(request);
	}

	getRepo(request: GetRepoRequest) {
		return this._codestream.getRepo(request);
	}

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

	async fetchStreams(request: FetchStreamsRequest) {
		if (this._streams === undefined) {
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

			const usersById = await this.ensureUsersById();
			const [channels, groups, ims] = await Promise.all([
				this.fetchChannels(usersById),
				this.fetchGroups(usersById),
				this.fetchIMs(usersById)
			]);

			this._streams = channels.concat(...groups, ...ims);
		}

		if (
			request.types == null ||
			request.types.length === 0 ||
			(request.types.includes(StreamType.Channel) && request.types.includes(StreamType.Direct))
		) {
			return { streams: this._streams! };
		}

		return {
			streams: this._streams.filter(s => request.types!.includes(s.type))
		};
	}

	private async fetchChannels(usersById: Map<string, CSUser>) {
		const response = await this._slack.channels.list({
			exclude_archived: true,
			exclude_members: false,
			limit: 1000
		});

		const { ok, error, channels } = response as WebAPICallResult & { channels: any };
		if (!ok) throw new Error(error);

		const streams: (CSChannelStream | CSDirectStream)[] = channels
			.map((c: any) => fromSlackChannel(c, usersById, this._slackUserId, this._codestreamTeamId))
			.filter(Boolean);
		return streams;
	}

	private async fetchGroups(usersById: Map<string, CSUser>) {
		const response = await this._slack.groups.list({
			exclude_archived: true,
			exclude_members: false,
			limit: 1000
		});

		const { ok, error, groups } = response as WebAPICallResult & { groups: any };
		if (!ok) throw new Error(error);

		const streams: (CSChannelStream | CSDirectStream)[] = groups
			.map((c: any) =>
				fromSlackChannelOrDirect(c, usersById, this._slackUserId, this._codestreamTeamId)
			)
			.filter(Boolean);
		return streams;
	}

	private async fetchIMs(usersById: Map<string, CSUser>) {
		const response = await this._slack.im.list({
			exclude_archived: true,
			exclude_members: false,
			limit: 1000
		});

		const { ok, error, ims } = response as WebAPICallResult & { ims: any };
		if (!ok) throw new Error(error);

		const streams: (CSChannelStream | CSDirectStream)[] = ims
			.map((c: any) => fromSlackDirect(c, usersById, this._slackUserId, this._codestreamTeamId))
			.filter(Boolean);
		return streams;
	}

	async fetchUnreadStreams(request: FetchUnreadStreamsRequest) {
		// TODO:
		return { streams: [] };
	}

	async getStream(request: GetStreamRequest) {
		if (request.type === StreamType.File) {
			return this._codestream.getStream(request);
		}

		const response = await this._slack.conversations.info({
			channel: request.streamId
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const members = await this.getStreamMembers(request.streamId);
		channel.members = members;

		const stream = fromSlackChannelOrDirect(
			channel,
			await this.ensureUsersById(),
			this._slackUserId,
			this._codestreamTeamId
		);

		return { stream: stream! };
	}

	private async getStreamMembers(streamId: string) {
		const response = await this._slack.conversations.members({
			channel: streamId,
			limit: 1000
		});

		const { ok, error, members } = response as WebAPICallResult & { members: any };
		if (!ok) throw new Error(error);

		return members;
	}

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

	async leaveStream(request: LeaveStreamRequest) {
		const response = await this._slack.conversations.leave({
			channel: request.streamId
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const stream = await this.getStream({ streamId: request.streamId })!;

		return stream!;
	}

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

	async updateStream(request: UpdateStreamRequest): Promise<UpdateStreamResponse> {
		throw new Error("Method not implemented.");
	}

	updateStreamMembership(
		request: UpdateStreamMembershipRequest
	): Promise<UpdateStreamMembershipResponse> {
		throw new Error("Method not implemented.");
	}

	async fetchTeams(request: FetchTeamsRequest) {
		const response = await this._codestream.fetchTeams(request);

		// Replace the current team's ids with slack ids
		const team = response.teams.find(t => t.id === this._codestreamTeamId);
		if (team !== undefined) {
			toSlackTeam(team, await this.ensureUsersById());
		}

		return response;
	}

	async getTeam(request: GetTeamRequest) {
		const response = await this._codestream.getTeam(request);

		// Replace the current team's ids with slack ids
		if (response.team != null && response.team.id === this._codestreamTeamId) {
			toSlackTeam(response.team, await this.ensureUsersById());
		}

		return response;
	}

	async fetchUsers(request: FetchUsersRequest) {
		if (this._users === undefined) {
			const response = await this._slack.users.list();

			const { ok, error, members } = response as WebAPICallResult & { members: any };
			if (!ok) throw new Error(error);

			const users: CSUser[] = members.map((m: any) => fromSlackUser(m, this._codestreamTeamId));

			// Find ourselves and replace it with our model
			const index = users.findIndex(u => u.id === this._user.id);
			users.splice(index, 1, this._user);

			this._users = users;

			this._usersById = new Map();
			this._usersByName = new Map();

			for (const user of users) {
				this._usersById.set(user.id, user);
				this._usersByName.set(user.username, user);
			}
		}

		return { users: this._users! };
	}

	async getUser(request: GetUserRequest) {
		if (request.userId === this.slackUserId) {
			return this.getMe();
		}

		const response = await this._slack.users.info({
			user: request.userId
		});

		const { ok, error, user: usr } = response as WebAPICallResult & { user: any };
		if (!ok) throw new Error(error);

		const user = fromSlackUser(usr, this._codestreamTeamId);

		return { user: user };
	}

	inviteUser(request: InviteUserRequest) {
		return this._codestream.inviteUser(request);
	}
}
