"use strict";
import { WebAPICallResult, WebClient, WebClientOptions } from "@slack/client";
import { RequestInit } from "node-fetch";
import { RealTimeMessage } from "../managers/realTimeMessage";
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
	FetchPostRepliesResponse,
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
import { ApiProvider, CodeStreamApiMiddleware, LoginOptions } from "./apiProvider";
import { CodeStreamApiProvider } from "./codestreamApi";

const defaultCreatedAt = 165816000000;
const multiPartyNamesRegEx = /^mpdm-([^-]+)(--.*)-1$/;
const multiPartyNameRegEx = /--([^-]+)/g;

const mentionsRegex = /(^|\s)@(\w+)(?:\b(?!@|[\(\{\[\<\-])|$)/g;
const slackMentionsRegex = /\<[@|!](\w+)\>/g;

export class SlackApiProvider implements ApiProvider {
	private _slack: WebClient | undefined;

	private readonly _codestreamUserId: string;
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
		const slackToken = providerInfo.accessToken;
		const slackOptions: WebClientOptions = { retryConfig: { retries: 1 } };
		this._slack = new WebClient(slackToken, slackOptions);

		this._codestreamUserId = user.id;
		this._slackUserId = providerInfo.userId;

		this._user = user;
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

	private get slack() {
		return this._slack!;
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

	async subscribe(listener: (e: RealTimeMessage) => any, thisArgs?: any) {
		await this._codestream.subscribe(listener, thisArgs);

		// TODO: Slack realtime here
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

		const response = await this.slack.users.info({
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
		const response = await this.slack.chat.postMessage({
			channel: streamId,
			text: text,
			as_user: true,
			thread_ts: request.parentPostId,
			unfurl_links: true
		});

		const { ok, error, message } = response as WebAPICallResult & { message: any };
		if (!ok) throw new Error(error);

		const usersById = await this.ensureUsersById();

		const post = CSPost.fromSlack(message, streamId, usersById, this._codestreamTeamId);

		return { post: post };
	}

	async deletePost(request: DeletePostRequest) {
		const postResponse = await this.getPost({ streamId: request.streamId, postId: request.postId });

		const response = await this.slack.chat.delete({
			channel: request.streamId,
			ts: request.postId,
			as_user: true
		});

		const { ok, error, message } = response as WebAPICallResult & { message: any };
		if (!ok) throw new Error(error);

		postResponse.post.deactivated = true;
		return { post: postResponse.post };
	}

	async editPost(request: EditPostRequest) {
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

		const response = await this.slack.chat.update({
			channel: request.streamId,
			ts: request.postId,
			as_user: true,
			text: text
		});

		const { ok, error, message } = response as WebAPICallResult & { message: any };
		if (!ok) throw new Error(error);

		const postResponse = this.getPost({ streamId: request.streamId, postId: request.postId });
		return postResponse;
	}

	fetchPostReplies(request: FetchPostRepliesRequest): Promise<FetchPostRepliesResponse> {
		throw new Error("Method not implemented.");
	}

	async fetchPosts(request: FetchPostsRequest) {
		let response;
		// This isn't ideal, but we can always pack some more info into the id to ensure we call the right thing
		switch (request.streamId[0]) {
			case "C":
				response = await this.slack.channels.history({
					channel: request.streamId,
					count: request.limit || 100,
					oldest: request.after == null ? undefined : String(request.after),
					latest: request.before == null ? undefined : String(request.before),
					inclusive: request.inclusive
				});

				break;

			case "G":
				response = await this.slack.groups.history({
					channel: request.streamId,
					count: request.limit || 100,
					oldest: request.after == null ? undefined : String(request.after),
					latest: request.before == null ? undefined : String(request.before),
					inclusive: request.inclusive
				});

				break;

			case "D":
				response = await this.slack.im.history({
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

		const usersById = await this.ensureUsersById();

		// Ensure the correct ordering
		messages.sort((a: any, b: any) => a.ts - b.ts);

		const posts = messages.map((m: any) =>
			CSPost.fromSlack(m, request.streamId, usersById, this._codestreamTeamId)
		) as CSPost[];

		return { posts: posts, more: has_more };
	}

	async getPost(request: GetPostRequest) {
		const response = await this.slack.conversations.history({
			channel: request.streamId,
			limit: 1,
			inclusive: true,
			latest: request.postId
		});

		const { ok, error, messages } = response as WebAPICallResult & { messages: any };
		if (!ok) throw new Error(error);

		const usersById = await this.ensureUsersById();

		const posts = messages.map((m: any) =>
			CSPost.fromSlack(m, request.streamId, usersById, this._codestreamTeamId)
		);

		return { post: posts[0] };
	}

	async markPostUnread(request: MarkPostUnreadRequest) {
		let response = await this.slack.conversations.info({
			channel: request.streamId
		});

		const { ok, error, channel: c } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		if (c.is_channel) {
			response = await this.slack.channels.mark({ channel: c.id, ts: request.postId });
			const { ok, error } = response as WebAPICallResult;
			if (!ok) throw new Error(error);
		}

		if (c.is_group) {
			response = await this.slack.groups.mark({ channel: c.id, ts: request.postId });
			const { ok, error } = response as WebAPICallResult;
			if (!ok) throw new Error(error);
		}

		if (c.is_im) {
			response = await this.slack.im.mark({ channel: c.id, ts: request.postId });
			const { ok, error } = response as WebAPICallResult;
			if (!ok) throw new Error(error);
		}

		return this.getPost({ streamId: request.streamId, postId: request.postId });
	}

	async reactToPost(request: ReactToPostRequest) {
		let response;

		for (const [name, value] of Object.entries(request.emojis)) {
			if (value) {
				response = await this.slack.reactions.add({
					channel: request.streamId,
					timestamp: request.postId,
					name: name
				});
			} else {
				response = await this.slack.reactions.remove({
					channel: request.streamId,
					timestamp: request.postId,
					name: name
				});
			}
		}

		const { ok, error } = response as WebAPICallResult;
		if (!ok) throw new Error(error);

		return this.getPost({ streamId: request.streamId, postId: request.postId });
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
			const response = await this.slack.conversations.list({
				exclude_archived: true,
				limit: 1000,
				types: "public_channel,private_channel,mpim,im"
			});

			const { ok, error, channels } = response as WebAPICallResult & { channels: any };
			if (!ok) throw new Error(error);

			const users = (await this.fetchUsers({})).users;
			const streams: (CSChannelStream | CSDirectStream)[] = channels
				.map((c: any) => CSStream.fromSlack(c, users, this._codestreamTeamId))
				.filter(Boolean);

			this._streams = streams;
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

	async fetchUnreadStreams(request: FetchUnreadStreamsRequest) {
		// TODO:
		return { streams: [] };
	}

	async getStream(request: GetStreamRequest) {
		const response = await this.slack.conversations.info({
			channel: request.streamId
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const users = (await this.fetchUsers({})).users;
		const stream = CSStream.fromSlack(channel, users, this._codestreamTeamId);

		return { stream: stream! };
	}

	async joinStream(request: JoinStreamRequest) {
		const response = await this.slack.conversations.join({
			channel: request.streamId
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const users = (await this.fetchUsers({})).users;
		const stream = CSStream.fromSlack(channel, users, this._codestreamTeamId);

		return { stream: stream! };
	}

	async leaveStream(request: LeaveStreamRequest) {
		const response = await this.slack.conversations.leave({
			channel: request.streamId
		});

		const { ok, error, channel } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		const stream = await this.getStream({ streamId: request.streamId })!;

		return stream!;
	}

	async markStreamRead(request: MarkStreamReadRequest) {
		let response = await this.slack.conversations.info({
			channel: request.streamId
		});

		const { ok, error, channel: c } = response as WebAPICallResult & { channel: any };
		if (!ok) throw new Error(error);

		if (c.is_channel) {
			response = await this.slack.channels.mark({ channel: c.id, ts: c.latest.ts });
			return {};
		}

		if (c.is_group) {
			response = await this.slack.groups.mark({ channel: c.id, ts: c.latest.ts });
			return {};
		}

		if (c.is_im) {
			response = await this.slack.im.mark({ channel: c.id, ts: c.latest.ts });
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
			const response = await this.slack.users.list();

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

		const response = await this.slack.users.info({
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
	export function fromSlack(channel: any, users: CSUser[], teamId: string): CSChannelStream {
		return {
			createdAt: channel.created,
			creatorId: channel.creator,
			isArchived: Boolean(channel.is_archived),
			id: channel.id,
			isTeamStream: Boolean(channel.is_general),
			name: channel.name || "",
			// TODO: Totally wrong
			memberIds: Boolean(channel.is_general)
				? undefined
				: channel.is_member
					? users.map(u => u.id)
					: [],
			modifiedAt: channel.created,
			privacy: channel.is_private ? "private" : "public",
			purpose: channel.purpose && channel.purpose.value,
			sortId: undefined!,
			teamId: teamId,
			type: StreamType.Channel
		};
	}
}

namespace CSDirectStream {
	export function fromSlack(channel: any, users: CSUser[], teamId: string): CSDirectStream {
		if (channel.is_im) {
			const user = users.find(u => u.id === channel.user);
			return {
				createdAt: channel.created,
				creatorId: channel.user,
				isArchived: Boolean(channel.is_user_deleted),
				id: channel.id,
				name: (user && user.username) || channel.user,
				// TODO: Totally wrong
				memberIds: [channel.user],
				modifiedAt: channel.created,
				privacy: channel.is_private,
				sortId: undefined!,
				teamId: teamId,
				type: StreamType.Direct
			};
		}

		const names = [];
		let match = multiPartyNamesRegEx.exec(channel.name);
		if (match != null) {
			const [, first, rest] = match;
			names.push(first);
			do {
				match = multiPartyNameRegEx.exec(rest);
				if (match == null) break;
				names.push(match[1]);
			} while (match != null);
		}

		return {
			createdAt: channel.created,
			creatorId: channel.user,
			isArchived: Boolean(channel.is_user_deleted),
			id: channel.id,
			name: names.join(", "),
			// TODO: Totally wrong
			memberIds: users.map(u => u.id),
			modifiedAt: channel.created,
			privacy: channel.is_private,
			purpose: channel.purpose && channel.purpose.value,
			sortId: undefined!,
			teamId: teamId,
			type: StreamType.Direct
		};
	}
}

namespace CSPost {
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
			id: post.ts,
			mentionedUserIds: mentionedUserIds,
			modifiedAt: timestamp,
			parentPostId: post.thread_ts,
			reactions: reactions,
			text: text,
			seqNum: post.ts,
			streamId: streamId,
			teamId: teamId
		};
	}
}

namespace CSStream {
	export function fromSlack(channel: any, users: CSUser[], teamId: string) {
		if (channel.is_channel || (channel.is_group && !channel.is_mpim)) {
			return CSChannelStream.fromSlack(channel, users, teamId);
		}

		if (channel.is_mpim || channel.is_im) {
			return CSDirectStream.fromSlack(channel, users, teamId);
		}

		return undefined;
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
			email: user.profile.email || "A",
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
