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
	CreateChannelStreamResponse,
	CreateDirectStreamRequest,
	CreateDirectStreamResponse,
	CreateMarkerLocationRequest,
	CreatePostInChannelOrDirectStreamRequest,
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
	CSTeam,
	CSUser,
	LoginResponse,
	StreamType
} from "../shared/api.protocol";
import { ApiProvider, CodeStreamApiMiddleware, LoginOptions, RTMessage } from "./apiProvider";
import { CodeStreamApiProvider } from "./codestreamApi";

const defaultCreatedAt = 165816000000;
const multiPartyNamesRegEx = /^mpdm-([^-]+)(--.*)-1$/;
const multiPartyNameRegEx = /--([^-]+)/g;

const mentionsRegex = /(^|\s)@(\w+)(?:\b(?!@|[\(\{\[\<\-])|$)/g;
const slackMentionsRegex = /\<[@|!](\w+)\>/g;

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
						const post = CSPost.fromSlack(
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
						const post = CSPost.fromSlack(
							e,
							e.channel,
							this._usersById || new Map(),
							this._codestreamTeamId
						);
						this._onDidReceiveMessage.fire({
							type: MessageType.Posts,
							data: [post]
						});
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
			CSTeam.toSlack(team, await this.ensureUsersById());
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
			const user = CSUser.fromSlack(usr, this._codestreamTeamId);
			return {
				user: {
					...me,
					// creatorId: user.id,
					deactivated: user.deactivated,
					email: user.email,
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
		let text;
		if (request.text && request.mentionedUserIds && request.mentionedUserIds.length) {
			text = CSPost.toSlackText(
				request.text,
				request.mentionedUserIds,
				await this.ensureUsersByName()
			);
		} else {
			text = request.text;
		}

		const streamId = (request as CreatePostInChannelOrDirectStreamRequest).streamId;
		const response = await this._slack.chat.postMessage({
			channel: streamId,
			text: text,
			as_user: true,
			thread_ts: request.parentPostId,
			unfurl_links: true
		});

		const { ok, error, message } = response as WebAPICallResult & { message: any };
		if (!ok) throw new Error(error);

		try {
			void (await this._codestream.updatePostsCount({}));
		} catch (ex) {
			debugger;
			Logger.error(ex, "Failed updating post count");
		}

		const usersById = await this.ensureUsersById();
		const post = CSPost.fromSlack(message, streamId, usersById, this._codestreamTeamId);

		if (request.codeBlocks && request.codeBlocks.length) {
			const [codeBlock] = request.codeBlocks;
			const createMarkerResponse = await this._codestream.createMarker({
				providerType: "slack",
				postStreamId: post.streamId,
				postId: post.id,
				streamId: codeBlock.streamId,
				file: codeBlock.file,
				repoId: codeBlock.repoId,
				remotes: codeBlock.remotes,
				commitHash: request.commitHashWhenPosted,
				code: codeBlock.code,
				location: codeBlock.location
				// type: codeBlock.type,
				// color: codeBlock.color,
				// status: codeBlock.status
			});
			const marker = createMarkerResponse.marker;
			// const fileStream = await Container.instance().files.getById(marker.streamId);
			post.codeBlocks = [
				{
					...codeBlock,
					// file: fileStream.file,
					// repoId: fileStream.repoId,
					markerId: marker.id
				} as CSCodeBlock
			];
		}
		return { post: post };
	}

	async deletePost(request: DeletePostRequest) {
		const { streamId, postId } = CSPost.fromSlackPostId(request.postId, request.streamId);
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
		const { streamId, postId } = CSPost.fromSlackPostId(request.postId, request.streamId);

		let text;
		if (request.text && request.mentionedUserIds && request.mentionedUserIds.length) {
			text = CSPost.toSlackText(
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

		const postResponse = this.getPost({ streamId: streamId, postId: postId });
		return postResponse;
	}

	async fetchPostReplies(request: FetchPostRepliesRequest) {
		const { streamId, postId } = CSPost.fromSlackPostId(request.postId, request.streamId);

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
		if (!ok) throw new Error(error);

		// Ensure the correct ordering
		messages.sort((a: any, b: any) => a.ts - b.ts);

		const usersById = await this.ensureUsersById();
		const posts = messages.map((m: any) =>
			CSPost.fromSlack(m, request.streamId, usersById, this._codestreamTeamId)
		) as CSPost[];

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
		const posts = messages.map((m: any) =>
			CSPost.fromSlack(m, request.streamId, usersById, this._codestreamTeamId)
		) as CSPost[];

		return { posts: posts, more: has_more };
	}

	async getPost(request: GetPostRequest) {
		const { streamId, postId } = CSPost.fromSlackPostId(request.postId, request.streamId);

		const response = await this._slack.conversations.history({
			channel: streamId,
			limit: 1,
			inclusive: true,
			latest: postId
		});

		const { ok, error, messages } = response as WebAPICallResult & { messages: any };
		if (!ok) throw new Error(error);

		const usersById = await this.ensureUsersById();

		const posts = messages.map((m: any) =>
			CSPost.fromSlack(m, streamId, usersById, this._codestreamTeamId)
		);

		return { post: posts[0] };
	}

	async markPostUnread(request: MarkPostUnreadRequest) {
		const { streamId, postId } = CSPost.fromSlackPostId(request.postId, request.streamId);

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
		const { streamId, postId } = CSPost.fromSlackPostId(request.postId, request.streamId);

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

	createChannelStream(request: CreateChannelStreamRequest): Promise<CreateChannelStreamResponse> {
		throw new Error("Method not implemented.");
	}

	createDirectStream(request: CreateDirectStreamRequest): Promise<CreateDirectStreamResponse> {
		throw new Error("Method not implemented.");
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
			.map((c: any) => CSStream.fromSlack(c, usersById, this._slackUserId, this._codestreamTeamId))
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
			.map((c: any) => CSStream.fromSlack(c, usersById, this._slackUserId, this._codestreamTeamId))
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
			.map((c: any) => CSStream.fromSlack(c, usersById, this._slackUserId, this._codestreamTeamId))
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

		const stream = CSStream.fromSlack(
			channel,
			await this.ensureUsersById(),
			this._slackUserId,
			this._codestreamTeamId
		);

		return { stream: stream! };
	}

	async joinStream(request: JoinStreamRequest) {
		const response = await this._slack.conversations.join({
			channel: request.streamId
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const stream = CSStream.fromSlack(
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

		if (c.is_channel) {
			response = await this._slack.channels.mark({ channel: c.id, ts: c.latest.ts });
			return {};
		}

		if (c.is_group) {
			response = await this._slack.groups.mark({ channel: c.id, ts: c.latest.ts });
			return {};
		}

		if (c.is_im) {
			response = await this._slack.im.mark({ channel: c.id, ts: c.latest.ts });
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
			CSTeam.toSlack(team, await this.ensureUsersById());
		}

		return response;
	}

	async getTeam(request: GetTeamRequest) {
		const response = await this._codestream.getTeam(request);

		// Replace the current team's ids with slack ids
		if (response.team !== undefined && response.team.id === this._codestreamTeamId) {
			CSTeam.toSlack(response.team, await this.ensureUsersById());
		}

		return response;
	}

	async fetchUsers(request: FetchUsersRequest) {
		if (this._users === undefined) {
			const response = await this._slack.users.list();

			const { ok, error, members } = response as WebAPICallResult & { members: any };
			if (!ok) throw new Error(error);

			const users: CSUser[] = members.map((m: any) => CSUser.fromSlack(m, this._codestreamTeamId));

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

		const user = CSUser.fromSlack(usr, this._codestreamTeamId);

		return { user: user };
	}

	inviteUser(request: InviteUserRequest) {
		return this._codestream.inviteUser(request);
	}
}

namespace CSChannelStream {
	export function fromSlack(
		channel: any,
		usersById: Map<string, CSUser>,
		slackUserId: string,
		codestreamTeamId: string
	): CSChannelStream {
		const { mostRecentId, mostRecentTimestamp } = CSStream.fromSlackLatest(channel);

		return {
			createdAt: channel.created,
			creatorId: channel.creator,
			isArchived: Boolean(channel.is_archived),
			id: channel.id,
			isTeamStream: Boolean(channel.is_general),
			name: channel.name || "",
			memberIds: Boolean(channel.is_general) ? undefined : channel.members,
			modifiedAt: channel.created,
			mostRecentPostCreatedAt: mostRecentTimestamp,
			mostRecentPostId: mostRecentId,
			privacy: channel.is_private ? "private" : "public",
			purpose: channel.purpose && channel.purpose.value,
			sortId: undefined!,
			teamId: codestreamTeamId,
			type: StreamType.Channel
		};
	}
}

namespace CSDirectStream {
	export function fromSlack(
		channel: any,
		usersById: Map<string, CSUser>,
		slackUserId: string,
		codestreamTeamId: string
	): CSDirectStream {
		const { mostRecentId, mostRecentTimestamp } = CSStream.fromSlackLatest(channel);

		if (channel.is_im) {
			const user = usersById.get(channel.user);

			return {
				createdAt: channel.created,
				creatorId: slackUserId,
				isArchived: Boolean(channel.is_user_deleted),
				id: channel.id,
				name: (user && user.username) || channel.user,
				memberIds: [slackUserId, channel.user],
				modifiedAt: channel.created,
				mostRecentPostCreatedAt: mostRecentTimestamp,
				mostRecentPostId: mostRecentId,
				privacy: channel.is_private ? "private" : "public",
				sortId: undefined!,
				teamId: codestreamTeamId,
				type: StreamType.Direct
			};
		}

		// const names = [];
		// let match = multiPartyNamesRegEx.exec(channel.name);
		// if (match != null) {
		// 	const [, first, rest] = match;
		// 	names.push(first);
		// 	do {
		// 		match = multiPartyNameRegEx.exec(rest);
		// 		if (match == null) break;
		// 		names.push(match[1]);
		// 	} while (match != null);
		// }

		const names: string[] = channel.members
			.filter((m: string) => m !== slackUserId)
			.map((m: string) => {
				const user = usersById.get(m);
				return user === undefined ? m : user.username || m;
			});
		names.sort((a, b) => a.localeCompare(b));

		return {
			createdAt: channel.created,
			creatorId: channel.creator,
			isArchived: Boolean(channel.is_archived),
			id: channel.id,
			name: names.join(", "),
			memberIds: channel.members,
			modifiedAt: channel.created,
			mostRecentPostCreatedAt: mostRecentTimestamp,
			mostRecentPostId: mostRecentId,
			privacy: channel.is_private ? "private" : "public",
			purpose: channel.purpose && channel.purpose.value,
			sortId: undefined!,
			teamId: codestreamTeamId,
			type: StreamType.Direct
		};
	}
}

namespace CSPost {
	export function toSlackPostId(postId: string, streamId: string) {
		return `${streamId}|${postId}`;
	}

	export function fromSlackPostId(
		postId: string,
		streamId: string
	): { streamId: string; postId: string } {
		const [sid, pid] = postId.split("|");
		if (!pid) {
			return { streamId: streamId, postId: postId };
		}
		return { streamId: sid, postId: pid };
	}

	export function toSlackText(
		text: string,
		mentionedUserIds: string[],
		usersByName: Map<string, CSUser>
	) {
		return text.replace(mentionsRegex, (match: string, prefix: string, mentionName: string) => {
			if (mentionName === "everyone" || mentionName === "channel" || mentionName === "here") {
				return `${prefix}<!${mentionName}>`;
			}

			const user = usersByName.get(mentionName);
			if (user !== undefined && mentionedUserIds.includes(user.id)) {
				return `${prefix}<@${user.id}>`;
			}

			return match;
		});
	}

	export function fromSlack(
		post: any,
		streamId: string,
		usersById: Map<string, CSUser>,
		teamId: string
	): CSPost {
		const mentionedUserIds: string[] = [];

		let text;
		if (post.text) {
			text = post.text
				.replace(slackMentionsRegex, (match: string, mentionId: string) => {
					if (mentionId === "everyone" || mentionId === "channel" || mentionId === "here") {
						return `@${mentionId}`;
					}

					const user = usersById.get(mentionId);
					if (user !== undefined) {
						mentionedUserIds.push(user.id);
						return `@${user.username}`;
					}

					return match;
				})
				// Slack always encodes < & > so decode them
				.replace("&lt;", "<")
				.replace("&gt;", ">");
		} else {
			text = post.text;
		}

		let reactions;
		if (post.reactions) {
			reactions = Object.create(null);
			for (const reaction of post.reactions) {
				reactions[reaction.name] = reaction.users;
			}
		}

		const timestamp = Number(post.ts.split(".")[0]) * 1000;
		return {
			createdAt: timestamp,
			creatorId: post.user || (post.bot_id && post.username),
			deactivated: false,
			hasBeenEdited: post.edited !== undefined,
			hasReplies: post.ts === post.thread_ts,
			id: CSPost.toSlackPostId(post.ts, streamId),
			mentionedUserIds: mentionedUserIds,
			modifiedAt: timestamp,
			parentPostId: post.thread_ts
				? CSPost.toSlackPostId(post.thread_ts, streamId)
				: post.thread_ts,
			reactions: reactions,
			text: text,
			seqNum: post.ts,
			streamId: streamId,
			teamId: teamId
		};
	}
}

namespace CSStream {
	export function fromSlack(
		channel: any,
		usersById: Map<string, CSUser>,
		slackUserId: string,
		codestreamTeamId: string
	) {
		if (channel.is_channel || (channel.is_group && !channel.is_mpim)) {
			return CSChannelStream.fromSlack(channel, usersById, slackUserId, codestreamTeamId);
		}

		if (channel.is_mpim || channel.is_im) {
			return CSDirectStream.fromSlack(channel, usersById, slackUserId, codestreamTeamId);
		}

		return undefined;
	}

	export function fromSlackLatest(channel: { id: string; latest?: { ts: string } }) {
		const latest = channel.latest && channel.latest.ts;
		let mostRecentId;
		let mostRecentTimestamp;
		if (latest) {
			mostRecentTimestamp = Number(latest.split(".")[0]) * 1000;
			mostRecentId = CSPost.toSlackPostId(latest, channel.id);
		}

		return { mostRecentId: mostRecentId, mostRecentTimestamp: mostRecentTimestamp };
	}
}

namespace CSTeam {
	export function toSlack(team: CSTeam, usersById: Map<string, CSUser>) {
		team.memberIds = [...usersById.keys()];
		// team.memberIds = team.memberIds.map(m => {
		// 	const u = usersById.get(m);
		// 	return u !== undefined ? u.id : m;
		// });
	}
}

namespace CSUser {
	export function fromSlack(user: any, teamId: string): CSUser {
		return {
			avatar: {
				image: user.profile.image_original,
				image48: user.profile.image_48
			},
			companyIds: [],
			createdAt: defaultCreatedAt,
			creatorId: user.id,
			deactivated: user.deleted,
			email: user.profile.email || "cs@unknown.com",
			firstName: user.profile.first_name,
			fullName: user.real_name,
			id: user.id,
			// TODO: Look this up in the CodeStream user list
			isRegistered: true,
			iWorkOn: undefined,
			lastPostCreatedAt: user.updated,
			lastName: user.profile.last_name,
			modifiedAt: user.updated,
			numInvites: 0,
			numMentions: 0,
			registeredAt: defaultCreatedAt,
			// TODO: Need to hold both codestream and slack teams?
			teamIds: [teamId],
			timeZone: user.tz,
			// TODO: ???
			totalPosts: 0,
			username: user.profile.display_name || user.name
		};
	}
}
