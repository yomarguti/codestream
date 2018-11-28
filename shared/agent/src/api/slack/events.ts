"use strict";
import { LogLevel, RTMClient } from "@slack/client";
import HttpsProxyAgent from "https-proxy-agent";
import { Emitter, Event } from "vscode-languageserver";
import { Container } from "../../container";
import { Logger, TraceLevel } from "../../logger";
import { ConnectionStatus, LogoutReason } from "../../shared/agent.protocol";
import { StreamType } from "../../shared/api.protocol";
import { debug, log } from "../../system";
import {
	MessageType,
	PreferencesRTMessage,
	RTMessage,
	StreamsRTMessage,
	UsersRTMessage
} from "../apiProvider";
import { SlackApiProvider } from "./slackApi";
import { fromSlackChannelIdToType, fromSlackPost } from "./slackApi.adapters";

enum SlackRtmEventTypes {
	ChannelArchived = "channel_archive",
	ChannelCreated = "channel_created",
	ChannelDeleted = "channel_deleted",
	ChannelHistoryChanged = "channel_history_changed",
	ChannelJoined = "channel_joined",
	ChannelLeft = "channel_left",
	ChannelMarked = "channel_marked",
	ChannelRenamed = "channel_rename",
	ChannelUnarchived = "channel_unarchive",

	DndChanged = "dnd_updated",
	UserDndChanged = "dnd_updated_user",

	Goodbye = "goodbye",

	GroupArchived = "group_archive",
	GroupClosed = "group_close",
	GroupDeleted = "group_deleted",
	GroupHistoryChanged = "group_history_changed",
	GroupJoined = "group_joined",
	GroupLeft = "group_left",
	GroupMarked = "group_marked",
	GroupOpened = "group_open",
	GroupRenamed = "group_rename",
	GroupUnarchived = "group_unarchive",

	ImClosed = "im_close",
	ImCreated = "im_created",
	ImHistoryChanged = "im_history_changed",
	ImMarked = "im_marked",
	ImOpened = "im_open",

	Message = "message",

	MemberJoined = "member_joined_channel",
	MemberLeft = "member_left_channel",

	PreferenceChanged = "pref_change",

	PresenceChanged = "manual_presence_change",
	UserPresenceChanged = "presence_change",

	ReactionAdded = "reaction_added",
	ReactionRemoved = "reaction_removed",

	UserAdded = "team_join",
	UserChanged = "user_change"
}

enum SlackRtmLifeCycleEventTypes {
	Authenticated = "authenticated",
	Connected = "connected",
	Connecting = "connecting",
	Disconnected = "disconnected",
	Disconnecting = "disconnecting",
	Error = "error",
	Reconnecting = "reconnecting"
}

enum SlackRtmMessageEventSubTypes {
	Changed = "message_changed",
	Deleted = "message_deleted",
	Replied = "message_replied",
	RepliedBroadcast = "thread_broadcast",

	ChannelPurposeChanged = "channel_purpose",
	GroupPurposeChanged = "group_purpose"
}

interface SlackEvent {
	type: SlackRtmEventTypes | string;
	subtype?: SlackRtmMessageEventSubTypes | string;

	[key: string]: any;
}

export class SlackEvents {
	private _onDidReceiveMessage = new Emitter<RTMessage>();
	get onDidReceiveMessage(): Event<RTMessage> {
		return this._onDidReceiveMessage.event;
	}

	private _connectivityHeartbeat: NodeJS.Timer | undefined;
	private readonly _meMentionRegex: RegExp;
	private _reconnecting: boolean = false;
	private readonly _slackRTM: RTMClient;
	private _userIds: string[] | undefined;

	constructor(
		slackToken: string,
		private readonly _api: SlackApiProvider,
		proxyAgent: HttpsProxyAgent | undefined
	) {
		this._slackRTM = new RTMClient(slackToken, {
			agent: proxyAgent,
			logLevel: Logger.level === TraceLevel.Debug ? LogLevel.DEBUG : LogLevel.INFO,
			logger: (level, message) => {
				Logger.log(`SLACK-RTM[${level}]: ${message}`);
				if (message.includes("unable to RTM start: An API error occurred: missing_scope")) {
					// If we are missing the scope, we have a token issue, force a logout -- and we give it a little time to let the initialization unwind
					setTimeout(() => void Container.instance().session.logout(LogoutReason.Token), 500);
				}
			}
		});

		this._slackRTM.on(SlackRtmEventTypes.Message, this.onSlackMessageChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.ReactionAdded, this.onSlackMessageChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.ReactionRemoved, this.onSlackMessageChanged, this);

		this._slackRTM.on(SlackRtmEventTypes.ChannelArchived, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.ChannelCreated, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.ChannelDeleted, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.ChannelHistoryChanged, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.ChannelJoined, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.ChannelLeft, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.ChannelMarked, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.ChannelRenamed, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.ChannelUnarchived, this.onSlackChannelChanged, this);

		this._slackRTM.on(SlackRtmEventTypes.GroupArchived, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.GroupClosed, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.GroupDeleted, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.GroupHistoryChanged, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.GroupJoined, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.GroupLeft, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.GroupMarked, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.GroupOpened, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.GroupRenamed, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.GroupUnarchived, this.onSlackChannelChanged, this);

		this._slackRTM.on(SlackRtmEventTypes.ImClosed, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.ImCreated, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.ImHistoryChanged, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.ImMarked, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.ImOpened, this.onSlackChannelChanged, this);

		this._slackRTM.on(SlackRtmEventTypes.MemberJoined, this.onSlackChannelChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.MemberLeft, this.onSlackChannelChanged, this);

		this._slackRTM.on(SlackRtmEventTypes.PreferenceChanged, this.onSlackUserChanged, this);

		this._slackRTM.on(SlackRtmEventTypes.PresenceChanged, this.onSlackUserChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.UserPresenceChanged, this.onSlackUserChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.DndChanged, this.onSlackUserChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.UserDndChanged, this.onSlackUserChanged, this);

		this._slackRTM.on(SlackRtmEventTypes.UserAdded, this.onSlackUserChanged, this);
		this._slackRTM.on(SlackRtmEventTypes.UserChanged, this.onSlackUserChanged, this);

		// this._slackRTM.on(
		// 	SlackRtmLifeCycleEventTypes.Authenticated,
		// 	this.onSlackConnectionChanged,
		// 	this
		// );

		this._slackRTM.on(
			SlackRtmLifeCycleEventTypes.Connected,
			(...args: any[]) =>
				this.onSlackConnectionChanged(SlackRtmLifeCycleEventTypes.Connected, ...args),
			this
		);
		this._slackRTM.on(
			SlackRtmLifeCycleEventTypes.Connecting,
			(...args: any[]) =>
				this.onSlackConnectionChanged(SlackRtmLifeCycleEventTypes.Connecting, ...args),
			this
		);
		this._slackRTM.on(
			SlackRtmLifeCycleEventTypes.Disconnected,
			(...args: any[]) =>
				this.onSlackConnectionChanged(SlackRtmLifeCycleEventTypes.Disconnected, ...args),
			this
		);
		this._slackRTM.on(
			SlackRtmLifeCycleEventTypes.Disconnecting,
			(...args: any[]) =>
				this.onSlackConnectionChanged(SlackRtmLifeCycleEventTypes.Disconnecting, ...args),
			this
		);
		this._slackRTM.on(
			SlackRtmLifeCycleEventTypes.Error,
			(...args: any[]) => this.onSlackConnectionChanged(SlackRtmLifeCycleEventTypes.Error, ...args),
			this
		);
		this._slackRTM.on(
			SlackRtmLifeCycleEventTypes.Reconnecting,
			(...args: any[]) =>
				this.onSlackConnectionChanged(SlackRtmLifeCycleEventTypes.Reconnecting, ...args),
			this
		);

		this._meMentionRegex = new RegExp(`\<(@${_api.userId}|\!everyone|\!channel|\!here)\>`);
	}

	get connected() {
		return this._slackRTM.connected;
	}

	@log()
	async connect(userIds?: string[]) {
		const cc = Logger.getCorrelationContext();

		try {
			this._userIds = userIds;
			if (userIds !== undefined && userIds.length !== 0) {
				this._slackRTM.subscribePresence(userIds);
			}

			void (await this._slackRTM.start());
		} catch (ex) {
			Logger.error(ex, cc, ex.data != null ? JSON.stringify(ex.data) : undefined);
			throw ex;
		}
	}

	@log()
	async disconnect() {
		const cc = Logger.getCorrelationContext();

		try {
			this.stopConnectivityPolling();

			if (this._slackRTM.connected) {
				return await this._slackRTM.disconnect();
			}
		} catch (ex) {
			Logger.error(ex, cc, ex.data != null ? JSON.stringify(ex.data) : undefined);
		}
	}

	@log()
	async reconnect() {
		const cc = Logger.getCorrelationContext();

		try {
			return await this.connect(this._userIds);
		} catch (ex) {
			Logger.error(ex, cc);
			throw ex;
		}
	}

	@debug({ condition: silent => !silent, timed: false })
	startConnectivityPolling(silent: boolean = false) {
		this._connectivityHeartbeat = setTimeout(this.onConnectivityHeartbeat.bind(this), 5000);
	}

	@debug()
	stopConnectivityPolling() {
		if (this._connectivityHeartbeat !== undefined) {
			clearTimeout(this._connectivityHeartbeat);
			this._connectivityHeartbeat = undefined;
		}
	}

	@log({
		prefix: (context, type: SlackRtmLifeCycleEventTypes) => `${context.prefix}(${type})`,
		timed: false
	})
	private async onSlackConnectionChanged(type: SlackRtmLifeCycleEventTypes, ...args: any[]) {
		const cc = Logger.getCorrelationContext();

		switch (type) {
			case SlackRtmLifeCycleEventTypes.Error:
				const [error] = args;
				Logger.warn(cc, `Error=${error && error.code}`);
				break;

			case SlackRtmLifeCycleEventTypes.Disconnected:
				Logger.log(cc, "Slack real-time connection has been disconnected, reconnecting...");

				this.stopConnectivityPolling();
				void (await this.reconnect());

				this._onDidReceiveMessage.fire({
					type: MessageType.Connection,
					data: { status: ConnectionStatus.Disconnected }
				});
				break;

			case SlackRtmLifeCycleEventTypes.Reconnecting:
				this._reconnecting = true;
				Logger.log(cc, "Slack real-time connection has been lost, attempting to reconnect...");

				this.stopConnectivityPolling();

				this._onDidReceiveMessage.fire({
					type: MessageType.Connection,
					data: { status: ConnectionStatus.Reconnecting }
				});
				break;

			case SlackRtmLifeCycleEventTypes.Disconnecting:
				this.stopConnectivityPolling();
				break;

			case SlackRtmLifeCycleEventTypes.Connected:
				this.startConnectivityPolling();

				if (this._reconnecting) {
					this._onDidReceiveMessage.fire({
						type: MessageType.Connection,
						data: { reset: true, status: ConnectionStatus.Reconnected }
					});
				}

				this._reconnecting = false;
				break;
		}
	}

	private onConnectivityHeartbeat() {
		this._connectivityHeartbeat = undefined;

		if (!this.connected) {
			Logger.warn(
				`${Logger.toLoggableName(this)}.onConnectivityHeartbeat`,
				"Slack real-time connection has been lost, reconnecting..."
			);
			// this.reconnect();

			return;
		}

		this.startConnectivityPolling(true);
	}

	@log({
		prefix: (context, e: SlackEvent) =>
			`${context.prefix}(${e.type}${e.subtype ? `:${e.subtype}` : ""})`
	})
	private async onSlackChannelChanged(e: SlackEvent) {
		const cc = Logger.getCorrelationContext();
		const { type, subtype } = e;

		try {
			switch (type) {
				case SlackRtmEventTypes.ChannelArchived:
				case SlackRtmEventTypes.GroupArchived: {
					const message = {
						type: MessageType.Streams,
						data: [
							{
								id: e.channel,
								$set: { isArchived: true }
							} as unknown
						]
					} as StreamsRTMessage;
					message.data = await Container.instance().streams.resolve(message);

					this._onDidReceiveMessage.fire(message);
					break;
				}
				case SlackRtmEventTypes.GroupClosed:
				case SlackRtmEventTypes.ImClosed: {
					const message = {
						type: MessageType.Streams,
						data: [
							{
								id: e.channel,
								$set: { isClosed: true }
							} as unknown
						]
					} as StreamsRTMessage;
					message.data = await Container.instance().streams.resolve(message);

					this._onDidReceiveMessage.fire(message);
					break;
				}
				case SlackRtmEventTypes.ChannelCreated:
				case SlackRtmEventTypes.ImCreated:
				case SlackRtmEventTypes.ChannelJoined:
				case SlackRtmEventTypes.GroupJoined: {
					// Don't trust the payload, since it might not be a full channel (e.g containing members)
					const response = await this._api.getStream({ streamId: e.channel.id });
					const message = {
						type: MessageType.Streams,
						data: [response.stream]
					} as StreamsRTMessage;
					message.data = await Container.instance().streams.resolve(message);

					this._onDidReceiveMessage.fire(message);
					break;
				}
				case SlackRtmEventTypes.ChannelDeleted:
				case SlackRtmEventTypes.GroupDeleted: {
					const message = {
						type: MessageType.Streams,
						data: [
							{
								id: e.channel,
								$set: { deactivated: true }
							} as unknown
						]
					} as StreamsRTMessage;
					message.data = await Container.instance().streams.resolve(message);

					this._onDidReceiveMessage.fire(message);
					break;
				}
				case SlackRtmEventTypes.GroupOpened:
				case SlackRtmEventTypes.ImOpened: {
					const message = {
						type: MessageType.Streams,
						data: [
							{
								id: e.channel,
								$set: { isClosed: false }
							} as unknown
						]
					} as StreamsRTMessage;
					message.data = await Container.instance().streams.resolve(message);

					this._onDidReceiveMessage.fire(message);
					break;
				}
				case SlackRtmEventTypes.ChannelHistoryChanged:
				case SlackRtmEventTypes.GroupHistoryChanged:
				case SlackRtmEventTypes.ImHistoryChanged: {
					// TODO: Need to clear the post cache for this stream
					break;
				}
				case SlackRtmEventTypes.MemberJoined: {
					const message = {
						type: MessageType.Streams,
						data: [
							{
								id: e.channel,
								$addToSet: { memberIds: [e.user] }
							} as unknown
						]
					} as StreamsRTMessage;
					message.data = await Container.instance().streams.resolve(message);

					this._onDidReceiveMessage.fire(message);
					break;
				}
				case SlackRtmEventTypes.MemberLeft: {
					const message = {
						type: MessageType.Streams,
						data: [
							{
								id: e.channel,
								$pull: { memberIds: [e.user] }
							} as unknown
						]
					} as StreamsRTMessage;
					message.data = await Container.instance().streams.resolve(message);

					this._onDidReceiveMessage.fire(message);
					break;
				}
				case SlackRtmEventTypes.ChannelLeft:
				case SlackRtmEventTypes.GroupLeft: {
					const message = {
						type: MessageType.Streams,
						data: [
							{
								id: e.channel,
								$pull: { memberIds: [this._api.userId] }
							} as unknown
						]
					} as StreamsRTMessage;
					message.data = await Container.instance().streams.resolve(message);

					this._onDidReceiveMessage.fire(message);
					break;
				}
				case SlackRtmEventTypes.ChannelMarked:
				case SlackRtmEventTypes.GroupMarked:
				case SlackRtmEventTypes.ImMarked: {
					this._api.unreads.update(
						e.channel,
						e.ts,
						e.mention_count_display || 0,
						Math.max(e.mention_count_display || 0, e.unread_count_display || 0)
					);
					break;
				}
				case SlackRtmEventTypes.ChannelRenamed:
				case SlackRtmEventTypes.GroupRenamed: {
					const message = {
						type: MessageType.Streams,
						data: [
							{
								id: e.channel.id,
								$set: { name: e.channel.name }
							} as unknown
						]
					} as StreamsRTMessage;
					message.data = await Container.instance().streams.resolve(message);

					this._onDidReceiveMessage.fire(message);
					break;
				}
				case SlackRtmEventTypes.ChannelUnarchived:
				case SlackRtmEventTypes.GroupUnarchived: {
					const message = {
						type: MessageType.Streams,
						data: [
							{
								id: e.channel,
								$set: { isArchived: false }
							} as unknown
						]
					} as StreamsRTMessage;
					message.data = await Container.instance().streams.resolve(message);

					this._onDidReceiveMessage.fire(message);
					break;
				}
			}
		} catch (ex) {
			Logger.error(ex, cc);
		}
	}

	@log({
		prefix: (context, e: SlackEvent) =>
			`${context.prefix}(${e.type}${e.subtype ? `:${e.subtype}` : ""})`
	})
	private async onSlackMessageChanged(e: SlackEvent) {
		const cc = Logger.getCorrelationContext();
		const { type, subtype } = e;

		try {
			switch (type) {
				case SlackRtmEventTypes.Message:
					switch (subtype) {
						case SlackRtmMessageEventSubTypes.Changed: {
							const response = await this._api.getPost({
								streamId: e.channel,
								postId: e.message.ts
							});
							this._onDidReceiveMessage.fire({
								type: MessageType.Posts,
								data: [response.post]
							});
							return;
						}
						case SlackRtmMessageEventSubTypes.Deleted: {
							const usernamesById = await this._api.ensureUsernamesById();
							const post = await fromSlackPost(
								e.previous_message,
								e.channel,
								usernamesById,
								this._api.teamId
							);
							post.deactivated = true;
							this._onDidReceiveMessage.fire({
								type: MessageType.Posts,
								data: [post]
							});
							return;
						}
						case SlackRtmMessageEventSubTypes.ChannelPurposeChanged:
						case SlackRtmMessageEventSubTypes.GroupPurposeChanged: {
							// Update the stream with the post data
							const message = {
								type: MessageType.Streams,
								data: [
									{
										id: e.channel,
										$set: { purpose: e.purpose }
									} as unknown
								]
							} as StreamsRTMessage;

							message.data = await Container.instance().streams.resolve(message);
							this._onDidReceiveMessage.fire(message);

							break;
						}
					}
					break;
				case SlackRtmEventTypes.ReactionAdded:
				case SlackRtmEventTypes.ReactionRemoved:
					const response = await this._api.getPost({ streamId: e.item.channel, postId: e.item.ts });
					this._onDidReceiveMessage.fire({
						type: MessageType.Posts,
						data: [response.post]
					});
					return;
			}

			if (e.user !== this._api.userId) {
				let mentioned = false;
				try {
					switch (fromSlackChannelIdToType(e.channel)) {
						case "direct":
							mentioned = true;
							break;

						case "group":
							if (e.text != null && this._meMentionRegex.test(e.text)) {
								mentioned = true;
							} else {
								// Need to look this up to see if this channel is a private channel or multi-party dm
								const stream = await Container.instance().streams.getById(e.channel);
								mentioned = stream.type === StreamType.Direct;
							}
							break;

						default:
							if (e.text != null && this._meMentionRegex.test(e.text)) {
								mentioned = true;
							} else {
								mentioned = false;
							}
							break;
					}
				} catch (ex) {
					Logger.error(ex, cc);
				}

				const { preferences } = await this._api.getPreferences();
				if (!preferences.mutedStreams[e.channel]) {
					this._api.unreads.increment(e.channel, mentioned);
				}
			}

			// Don't trust the payload, since it might not be a full message
			const { post } = await this._api.getPost({ streamId: e.channel, postId: e.ts });
			this._onDidReceiveMessage.fire({
				type: MessageType.Posts,
				data: [post]
			});

			// Update the stream with the post data
			const message = {
				type: MessageType.Streams,
				data: [
					{
						id: post.streamId,
						$set: {
							modifiedAt: post.createdAt,
							mostRecentPostCreatedAt: post.createdAt,
							mostRecentPostId: post.id
						}
					} as unknown
				]
			} as StreamsRTMessage;

			message.data = await Container.instance().streams.resolve(message);
			this._onDidReceiveMessage.fire(message);
		} catch (ex) {
			Logger.error(ex, cc);
		}
	}

	@log({
		prefix: (context, e: SlackEvent) => `${context.prefix}(${e.type})`
	})
	private async onSlackUserChanged(e: SlackEvent) {
		const cc = Logger.getCorrelationContext();
		const { type } = e;

		try {
			switch (type) {
				case SlackRtmEventTypes.DndChanged: {
					const message = {
						type: MessageType.Users,
						data: [
							{
								id: this._api.userId,
								$set: {
									dnd: e.dnd_status.dnd_enabled
								}
							} as unknown
						]
					} as UsersRTMessage;

					message.data = await Container.instance().users.resolve(message);
					this._onDidReceiveMessage.fire(message);
					break;
				}
				case SlackRtmEventTypes.UserDndChanged: {
					const message = {
						type: MessageType.Users,
						data: [
							{
								id: e.user,
								$set: {
									dnd: e.dnd_status.dnd_enabled
								}
							} as unknown
						]
					} as UsersRTMessage;

					message.data = await Container.instance().users.resolve(message);
					this._onDidReceiveMessage.fire(message);
					break;
				}
				case SlackRtmEventTypes.PreferenceChanged: {
					// TODO: Handle other prefs?
					if (e.name === "muted_channels") {
						const { preferences } = await this._api.getPreferences();

						const mutedIds = e.value.split(",").filter(Boolean);
						const unMute = Object.keys(preferences.mutedStreams || {}).filter(
							streamId => !mutedIds.includes(streamId)
						);

						const message = {
							type: MessageType.Preferences,
							data: [
								{
									id: this._api.userId,
									$set: mutedIds.reduce(
										(result: object, streamId: string) => ({
											...result,
											[`preferences.mutedStreams.${streamId}`]: true
										}),
										{}
									),
									$unset: unMute.reduce(
										(result: object, streamId: string) => ({
											...result,
											[`preferences.mutedStreams.${streamId}`]: true
										}),
										{}
									)
								} as unknown
							]
						} as PreferencesRTMessage;

						const resolvedUser = await Container.instance().users.resolve(message);
						message.data = resolvedUser[0].preferences!;
						this._onDidReceiveMessage.fire(message);
					}
					break;
				}
				case SlackRtmEventTypes.PresenceChanged: {
					const message = {
						type: MessageType.Users,
						data: [
							{
								id: this._api.userId,
								$set: {
									presence: e.presence
								}
							} as unknown
						]
					} as UsersRTMessage;

					message.data = await Container.instance().users.resolve(message);
					this._onDidReceiveMessage.fire(message);
					break;
				}
				case SlackRtmEventTypes.UserPresenceChanged: {
					let data;
					if (e.users != null) {
						data = e.users.map((u: any) => ({
							id: u,
							$set: {
								presence: e.presence
							}
						}));
					} else {
						data = [
							{
								id: e.user,
								$set: {
									presence: e.presence
								}
							}
						];
					}

					const message = {
						type: MessageType.Users,
						data: data
					} as UsersRTMessage;

					message.data = await Container.instance().users.resolve(message);
					this._onDidReceiveMessage.fire(message);
					break;
				}
				case SlackRtmEventTypes.UserAdded: {
					// Don't trust the payload, since it might not be a full channel
					const response = await this._api.getUser({ userId: e.user.id });
					const message = {
						type: MessageType.Users,
						data: [response.user]
					} as UsersRTMessage;
					message.data = await Container.instance().users.resolve(message);

					this._onDidReceiveMessage.fire(message);
					break;
				}
				case SlackRtmEventTypes.UserChanged: {
					const user = Container.instance().users.getById(e.user.id);

					// Don't trust the payload, since it might not be a full channel
					const response = await this._api.getUser({ userId: e.user.id });
					const message = {
						type: MessageType.Users,
						// Make sure to take our existing props (because of last reads, presence, dnd, etc)
						data: [user != null ? { ...user, ...response.user } : response.user]
					} as UsersRTMessage;
					message.data = await Container.instance().users.resolve(message);

					this._onDidReceiveMessage.fire(message);
					break;
				}
			}
		} catch (ex) {
			Logger.error(ex, cc);
		}
	}
}
