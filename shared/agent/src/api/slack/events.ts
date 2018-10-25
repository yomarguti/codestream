"use strict";
import { RTMClient } from "@slack/client";
import { Emitter, Event } from "vscode-languageserver";
import { Container } from "../../container";
import { Logger } from "../../logger";
import { StreamType } from "../../shared/api.protocol";
import { MessageType, RTMessage, StreamsRTMessage, UsersRTMessage } from "../apiProvider";
import { SlackApiProvider } from "./slackApi";
import {
	fromSlackChannelIdToType,
	fromSlackChannelOrDirect,
	fromSlackPost
} from "./slackApi.adapters";

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
	Disconnected = "disconnected",
	Disconnecting = "disconnecting",
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

	private readonly _meMentionRegex: RegExp;
	private readonly _slackRTM: RTMClient;

	constructor(slackToken: string, private readonly _api: SlackApiProvider) {
		this._slackRTM = new RTMClient(slackToken);

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
			SlackRtmLifeCycleEventTypes.Disconnected,
			this.onSlackConnectionChanged,
			this
		);
		this._slackRTM.on(
			SlackRtmLifeCycleEventTypes.Disconnecting,
			this.onSlackConnectionChanged,
			this
		);
		this._slackRTM.on(
			SlackRtmLifeCycleEventTypes.Reconnecting,
			this.onSlackConnectionChanged,
			this
		);

		this._meMentionRegex = new RegExp(`\<(@${_api.userId}|\!everyone|\!channel|\!here)\>`);
	}

	get connected() {
		return this._slackRTM.connected;
	}

	async connect(userIds?: string[]) {
		if (userIds !== undefined && userIds.length !== 0) {
			this._slackRTM.subscribePresence(userIds);
		}

		void (await this._slackRTM.start());
	}

	disconnect() {
		return this._slackRTM.disconnect();
	}

	reconnect() {
		return this._slackRTM.start();
	}

	private async onSlackConnectionChanged(e: any) {
		Logger.logWithDebugParams(`SlackEvents.onSlackConnectionChanged`, e);
	}

	private async onSlackChannelChanged(e: SlackEvent) {
		const { type, subtype } = e;

		try {
			Logger.logWithDebugParams(
				`SlackEvents.onSlackChannelChanged(${type}${subtype ? `:${subtype}` : ""})`,
				e
			);

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
				case SlackRtmEventTypes.ImCreated: {
					// Don't trust the payload, since it might not be a full channel
					const response = await this._api.getStream({ streamId: e.channel });
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
				case SlackRtmEventTypes.ChannelJoined:
				case SlackRtmEventTypes.GroupJoined: {
					const message = {
						type: MessageType.Streams,
						data: [
							fromSlackChannelOrDirect(
								e.channel,
								await this._api.ensureUsernamesById(),
								this._api.userId,
								this._api.teamId
							)
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
			Logger.error(ex, `SlackEvents.onSlackChannelChanged(${type}${subtype ? `:${subtype}` : ""})`);
		}
	}

	private async onSlackMessageChanged(e: SlackEvent) {
		const { type, subtype } = e;

		try {
			Logger.logWithDebugParams(
				`SlackEvents.onSlackMessageChanged(${type}${subtype ? `:${subtype}` : ""})`,
				e
			);

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
					Logger.error(
						ex,
						`SlackEvents.onSlackMessageChanged(${type}${subtype ? `:${subtype}` : ""})`
					);
				}
				this._api.unreads.increment(e.channel, mentioned);
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
			Logger.error(ex, `SlackEvents.onSlackMessageChanged(${type}${subtype ? `:${subtype}` : ""})`);
		}
	}

	private async onSlackUserChanged(e: SlackEvent) {
		const { type } = e;

		try {
			Logger.logWithDebugParams(`SlackEvents.onSlackUserChanged(${type}})`, e);

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
						const message = {
							type: MessageType.Users,
							data: [
								{
									id: this._api.userId,
									$set: {
										"preferences.mutedStreams": e.value.split(",")
									}
								} as unknown
							]
						} as UsersRTMessage;

						message.data = await Container.instance().users.resolve(message);
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
			Logger.error(ex, `SlackEvents.onSlackUserChanged(${type})`);
		}
	}
}
