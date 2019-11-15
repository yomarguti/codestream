"use strict";
import { ActionsBlock, KnownBlock, MessageAttachment } from "@slack/web-api";
import { CodemarkPlus } from "protocol/agent.protocol";
import { SessionContainer } from "../../container";
import { Logger } from "../../logger";
import {
	CodemarkType,
	CSChannelStream,
	CSCodemark,
	CSDirectStream,
	CSMarker,
	CSMarkerLocations,
	CSPost,
	CSTeam,
	CSUser,
	StreamType
} from "../../protocol/api.protocol";
import { providerNamesById } from "../../providers/provider";
import { Marker, toActionId, toExternalActionId, toReplyActionId } from "../extensions";

const defaultCreatedAt = 181886400000;
const multiPartyNamesRegEx = /^mpdm-([^-]+)(--.*)-1$/;
const multiPartyNameRegEx = /--([^-]+)/g;

const codemarkAttachmentRegex = /codestream\:\/\/codemark\/(\w+)(?:\?teamId=)?(\w+)?/;
const markerAttachmentRegex = /codestream\:\/\/marker\/(.*)/;
const mentionsRegex = /(^|\s)@(\w+)(?:\b(?!@|[\(\{\[\<\-])|$)/g;
const pseudoMentionsRegex = /(^|\s)@(everyone|channel|here)(?:\b(?!@|[\(\{\[\<\-])|$)/g;

// Docs here: https://api.slack.com/docs/message-formatting
const slackCommandsRegex = /\<!(\w+)\|(\w+)\>/g;
const slackChannelsRegex = /\<#(\w+)\|(\w+)\>/g;
const slackMentionsRegex = /\<[@!](\w+)(?:\|(\w+))?\>/g;
const slackLinkRegex = /\<((?:https?:\/\/|mailto:).*?)(?:\|(.*?))?\>/g;
// const slackSlashCommandRegex = /^\/(\w+)(?:\b(?!@|[\(\{\[\<\-])|$)/;

type Blocks = KnownBlock[];

export function fromSlackChannelIdToType(
	streamId: string
): "channel" | "group" | "direct" | undefined {
	switch (streamId[0]) {
		case "C":
			return "channel";
		case "G":
			return "group";
		case "D":
			return "direct";
	}
	return undefined;
}

export function fromSlackChannelOrDirect(
	channel: any,
	usernamesById: Map<string, string>,
	slackUserId: string,
	codestreamTeamId: string
) {
	if (channel.is_channel || (channel.is_group && !channel.is_mpim)) {
		return fromSlackChannel(channel, slackUserId, codestreamTeamId);
	}

	if (channel.is_mpim || channel.is_im) {
		return fromSlackDirect(channel, usernamesById, slackUserId, codestreamTeamId);
	}

	return undefined;
}

export function fromSlackChannelOrDirectLatest(channel: { id: string; latest?: { ts: string } }) {
	const latest = channel.latest && channel.latest.ts;
	let mostRecentId;
	let mostRecentTimestamp;
	if (latest) {
		mostRecentTimestamp = Number(latest.split(".")[0]) * 1000;
		mostRecentId = toSlackPostId(latest, channel.id);
	}

	return { mostRecentId: mostRecentId, mostRecentTimestamp: mostRecentTimestamp };
}

export function fromSlackChannel(
	channel: any,
	slackUserId: string,
	codestreamTeamId: string
): CSChannelStream {
	const { mostRecentId, mostRecentTimestamp } = fromSlackChannelOrDirectLatest(channel);

	let memberIds: string[] | undefined;
	if (!channel.is_general) {
		// TODO: If we are missing membership, what should we do?
		// Add an isMember propery to the stream and keep members undefined ?
		memberIds = channel.members == null ? [slackUserId] : channel.members;
	}

	return {
		createdAt: channel.created * 1000,
		creatorId: channel.creator,
		id: channel.id,
		isArchived: Boolean(channel.is_archived),
		isTeamStream: Boolean(channel.is_general),
		name: channel.name || "",
		memberIds: memberIds,
		modifiedAt: mostRecentTimestamp || channel.created * 1000,
		mostRecentPostCreatedAt: mostRecentTimestamp,
		mostRecentPostId: mostRecentId,
		priority: channel.priority,
		privacy: (channel.is_private == null
		? channel.is_group
		: channel.is_private)
			? "private"
			: "public",
		purpose: channel.purpose && channel.purpose.value,
		sortId: undefined!,
		teamId: codestreamTeamId,
		type: StreamType.Channel
	};
}

export function fromSlackDirect(
	channel: any,
	usernamesById: Map<string, string>,
	slackUserId: string,
	codestreamTeamId: string
): CSDirectStream {
	const { mostRecentId, mostRecentTimestamp } = fromSlackChannelOrDirectLatest(channel);

	let closed;
	if (channel.is_open == null) {
		if (
			channel.priority >= 0 &&
			// Assume everything below that magic number indicates something you don't care about in slack
			channel.priority <= 0.019260956929976 &&
			channel.user !== "USLACKBOT" &&
			channel.user !== slackUserId
		) {
			closed = true;
		}
	} else {
		closed = !Boolean(channel.is_open);
	}

	if (channel.is_im) {
		const username = usernamesById.get(channel.user);

		// TODO: Set muted when channel.is_open = false
		return {
			createdAt: channel.created * 1000,
			creatorId: slackUserId,
			id: channel.id,
			isArchived: Boolean(channel.is_user_deleted),
			isClosed: closed,
			name: username || channel.user,
			memberIds: channel.user === slackUserId ? [slackUserId] : [slackUserId, channel.user],
			modifiedAt:
				channel.is_open === false
					? channel.created * 1000
					: mostRecentTimestamp || channel.created * 1000,
			mostRecentPostCreatedAt: channel.is_open === false ? undefined : mostRecentTimestamp,
			mostRecentPostId: mostRecentId,
			priority: channel.priority,
			privacy: "private",
			sortId: undefined!,
			teamId: codestreamTeamId,
			type: StreamType.Direct
		};
	}

	let names: string[];
	if (channel.members != null) {
		names = channel.members
			.filter((m: string) => m !== slackUserId)
			.map((m: string) => {
				const username = usernamesById.get(m);
				return username === undefined ? m : username || m;
			});
	} else {
		let match = multiPartyNamesRegEx.exec(channel.name);
		if (match != null) {
			const [, first, rest] = match;
			names = [first];
			do {
				match = multiPartyNameRegEx.exec(rest);
				if (match == null) break;

				names.push(match[1]);
			} while (match != null);

			const index = names.indexOf(usernamesById.get(slackUserId)!.toLowerCase());
			if (index !== -1) {
				names.splice(index, 1);
			}
		} else {
			names = ["Unknown"];
		}
		names.sort((a, b) => a.localeCompare(b));
	}

	// TODO: If we are missing membership, what should we do?
	// Add an isMember propery to the stream and keep members undefined ?
	const memberIds: string[] = channel.members == null ? [slackUserId] : channel.members;

	return {
		createdAt: channel.created * 1000,
		creatorId: channel.creator,
		id: channel.id,
		isArchived: Boolean(channel.is_archived),
		isClosed: closed,
		name: names.join(", "),
		memberIds: memberIds,
		modifiedAt: mostRecentTimestamp || channel.created * 1000,
		mostRecentPostCreatedAt: mostRecentTimestamp,
		mostRecentPostId: mostRecentId,
		priority: channel.priority,
		privacy: "private",
		purpose: channel.purpose && channel.purpose.value,
		sortId: undefined!,
		teamId: codestreamTeamId,
		type: StreamType.Direct
	};
}

export async function fromSlackPost(
	post: {
		reactions?: { name: string; users: any[] }[];
		blocks?: KnownBlock[];
		attachments?: any[];
		files?: any;
		user: any;
		edited: {
			ts: any;
		};
		thread_ts: any;
		ts: string;
	},
	streamId: string,
	usernamesById: Map<string, string>,
	teamId: string
): Promise<CSPost> {
	const mentionedUserIds: string[] = [];

	let text = fromSlackPostText(post, usernamesById, mentionedUserIds);

	let reactions;
	if (post.reactions) {
		reactions = Object.create(null);
		for (const reaction of post.reactions) {
			reactions[reaction.name] = reaction.users;
		}
	}

	let codemark: CSCodemark | undefined;
	if (post.blocks != null && post.blocks.length !== 0) {
		codemark = await fromSlackPostBlocksToCodemark(post.blocks, teamId);
	}

	if (post.attachments != null && post.attachments.length !== 0) {
		// Filter out unfurled links
		// TODO: Turn unfurled images into files

		if (codemark == null) {
			// legacy slack posts with codemarks
			const attachments = post.attachments.filter((a: any) => a.from_url == null);
			if (attachments.length !== 0) {
				codemark = await fromSlackPostAttachmentToCodemark(attachments, teamId);
				if (codemark == null) {
					// legacy markers
					const marker = await fromSlackPostAttachmentToMarker(attachments);
					if (marker) {
						codemark = await SessionContainer.instance().codemarks.getById(marker.codemarkId);
					}
				}
				if (codemark == null) {
					// Get text/fallback for attachments
					text += "\n";
					for (const attachment of attachments) {
						text += `\n${attachment.text || attachment.fallback}`;
					}
				}
			}
		}
	}

	let files;
	if (post.files && post.files.length !== 0) {
		files = post.files.map(fromSlackPostFile);
	}

	const timestamp = Number(post.ts.split(".")[0]) * 1000;
	return {
		codemarkId: codemark && codemark.id,
		createdAt: timestamp,
		creatorId: post.user || "codestream",
		deactivated: false,
		files: files,
		hasBeenEdited: post.edited != null,
		numReplies: post.ts === post.thread_ts ? 1 : 0, // FIXME KB - what's the Slack post property?
		id: toSlackPostId(post.ts, streamId),
		mentionedUserIds: mentionedUserIds,
		modifiedAt: post.edited != null ? Number(post.edited.ts.split(".")[0]) * 1000 : timestamp,
		parentPostId: post.thread_ts ? toSlackPostId(post.thread_ts, streamId) : post.thread_ts,
		reactions: reactions,
		text: text,
		seqNum: post.ts,
		streamId: streamId,
		teamId: teamId
	};
}

export async function fromMeMessageSlackPost(
	ts: string,
	streamId: string,
	teamId: string,
	text: string,
	codemark?: CodemarkPlus
): Promise<CSPost> {
	const mentionedUserIds: string[] = [];

	const timestamp = Number(ts.split(".")[0]) * 1000;
	return {
		codemarkId: codemark && codemark.id,
		createdAt: timestamp,
		creatorId: "codestream",
		deactivated: false,
		files: undefined,
		hasBeenEdited: false,
		numReplies: 0,
		id: toSlackPostId(ts, streamId),
		mentionedUserIds: mentionedUserIds,
		modifiedAt: timestamp,
		parentPostId: undefined,
		reactions: undefined,
		text: text,
		seqNum: ts,
		streamId: streamId,
		teamId: teamId
	};
}

export function fromSlackPostId<T extends string | undefined>(
	postId: T,
	streamId: string
): { streamId: string; postId: T } {
	if (postId == null) {
		return { streamId: streamId, postId: postId };
	}

	const [sid, pid] = postId.split("|");
	if (!pid) {
		return { streamId: streamId, postId: postId };
	}
	return { streamId: sid, postId: pid as T };
}

async function fromSlackPostAttachmentToCodemark(
	attachments: MessageAttachment[],
	codestreamTeamId: string
): Promise<CSCodemark | undefined> {
	const attachment = attachments.find(
		(a: any) => a.callback_id != null && codemarkAttachmentRegex.test(a.callback_id)
	);
	if (attachment == null) return undefined;

	const match = codemarkAttachmentRegex.exec(attachment.callback_id || "");
	if (match == null) return undefined;

	const [, codemarkId, teamId] = match;

	if (teamId && teamId !== codestreamTeamId) {
		return undefined;
	}

	try {
		return await SessionContainer.instance().codemarks.getById(codemarkId);
	} catch (ex) {
		Logger.error(ex, `Failed to find codemark=${codemarkId}`);
		return undefined;
	}
}

async function fromSlackPostBlocksToCodemark(
	blocks: Blocks,
	codestreamTeamId: string
): Promise<CSCodemark | undefined> {
	const block = blocks.find(
		(b: KnownBlock) =>
			b.type === "context" && b.block_id != null && codemarkAttachmentRegex.test(b.block_id)
	);
	if (block == null) return undefined;

	const match = codemarkAttachmentRegex.exec(block.block_id || "");
	if (match == null) return undefined;

	const [, codemarkId, teamId] = match;

	if (teamId && teamId !== codestreamTeamId) {
		return undefined;
	}

	try {
		return await SessionContainer.instance().codemarks.getById(codemarkId);
	} catch (ex) {
		Logger.error(ex, `Failed to find codemark=${codemarkId}`);
		return undefined;
	}
}

export function fromSlackPostFile(file: any) {
	const image = file != null && file.mimetype != null && file.mimetype.startsWith("image/");

	let preview;
	if (image) {
		preview = {
			url: file.thumb_480,
			height: file.thumb_480_h,
			width: file.thumb_480_w
		};
	} else {
		preview = file.preview;
	}

	let type;
	switch (file.mode) {
		case "hosted":
			if (image) {
				type = "image";
				break;
			}

			type = "hosted";
			break;

		case "space":
			type = "post";
			break;

		default:
			type = file.mode;
	}

	return {
		mimetype: file.mimetype,
		name: file.name,
		title: file.title,
		type: type,
		url: file.permalink,
		preview: preview
	};
}

export async function fromSlackPostAttachmentToMarker(
	attachments: MessageAttachment[]
): Promise<CSMarker | undefined> {
	const attachment = attachments.find(
		(a: any) => a.callback_id != null && markerAttachmentRegex.test(a.callback_id)
	);
	if (attachment == null) return undefined;

	const match = markerAttachmentRegex.exec(attachment.callback_id || "");
	if (match == null) return undefined;

	const [, markerId] = match;

	try {
		return await SessionContainer.instance().markers.getById(markerId);
	} catch (ex) {
		Logger.error(ex, `Failed to find marker=${markerId}`);
		return undefined;
	}
}

export function fromSlackPostText(
	post: any,
	usernamesById: Map<string, string>,
	mentionedUserIds: string[]
): string {
	if (!post.text) return post.text || "";

	let text = post.text
		.replace(slackMentionsRegex, (match: string, mentionId: string, label?: string) => {
			if (mentionId === "everyone" || mentionId === "channel" || mentionId === "here") {
				return `@${mentionId}`;
			}

			const username = usernamesById.get(mentionId);
			if (username !== undefined) {
				mentionedUserIds.push(mentionId);
				return `@${username}`;
			}

			if (label != null) {
				return label;
			}

			return match;
		})
		.replace(slackChannelsRegex, (match: string, channel: string, name: string) => {
			return `#${name}`;
		})
		.replace(slackCommandsRegex, (match: string, command: string, label: string) =>
			label == null ? command : label
		)
		.replace(slackLinkRegex, (match: string, url: string, label: string) =>
			label == null ? url : `[${label}](url)`
		)
		// Slack always encodes &, <, > so decode them
		.replace("&amp;", "&")
		.replace("&lt;", "<")
		.replace("&gt;", ">");

	if (post.subtype === "me_message") {
		text = `/me ${text}`;
	}

	return text;
}

export function fromSlackUser(user: any, teamId: string, codestreamUsers: CSUser[]): CSUser {
	let codestreamId: string | undefined;
	if (codestreamUsers.length !== 0) {
		const identity = `slack::${user.id}`;
		const u = codestreamUsers.find(m =>
			m.providerIdentities == null ? false : m.providerIdentities.includes(identity)
		);
		if (u !== undefined) {
			codestreamId = u.id;
		}
	}

	return {
		avatar: {
			image: user.profile.image_original,
			image48: user.profile.image_48
		},
		companyIds: [],
		createdAt: defaultCreatedAt,
		creatorId: user.id,
		deactivated: user.deleted,
		email: user.profile.email || `cs-${user.id}@unknown.com`,
		firstName: user.profile.first_name,
		fullName: user.real_name,
		id: user.id,
		codestreamId: codestreamId,
		isRegistered: codestreamId !== undefined,
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

export function toSlackPostId(postId: string, streamId: string) {
	return `${streamId}|${postId}`;
}

export function toSlackPostBlocks(
	codemark: CodemarkPlus,
	remotes: string[] | undefined,
	markerLocations: CSMarkerLocations[] | undefined,
	usernamesById: Map<string, string>,
	userIdsByName: Map<string, string>
): Blocks {
	const blocks: Blocks = [];

	switch (codemark.type) {
		case CodemarkType.Comment:
		case CodemarkType.Trap: {
			blocks.push({
				type: "section",
				text: {
					type: "mrkdwn",
					text: toSlackText(codemark.text, userIdsByName)
				}
			});

			break;
		}
		case CodemarkType.Bookmark: {
			blocks.push({
				type: "section",
				text: {
					type: "mrkdwn",
					// Bookmarks use the title rather than text
					text: toSlackText(codemark.title, userIdsByName)
				}
			});

			break;
		}
		case CodemarkType.Issue:
		case CodemarkType.Question: {
			let text;
			if (codemark.title) {
				text = `*${toSlackText(codemark.title, userIdsByName)}*`;
			}

			if (codemark.text) {
				text = `${text ? `${text}\n` : ""}${toSlackText(codemark.text, userIdsByName)}`;
			}

			if (text) {
				blocks.push({
					type: "section",
					text: {
						type: "mrkdwn",
						text: text
					}
				});
			}

			break;
		}
	}

	if (codemark.assignees !== undefined && codemark.assignees.length !== 0) {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*Assignees*\n${codemark.assignees.map(a => usernamesById.get(a) || "").join(", ")}`
			}
		});
	}

	if (
		codemark.externalProvider !== undefined &&
		codemark.externalAssignees !== undefined &&
		codemark.externalAssignees.length !== 0
	) {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*Assignees*\n${codemark.externalAssignees.map(a => a.displayName).join(", ")}`
			}
		});
	}

	let counter = 0;

	if (codemark.markers !== undefined && codemark.markers.length) {
		for (const marker of codemark.markers) {
			counter++;

			let filename = marker.file;
			let start = undefined;
			let end = undefined;

			if (markerLocations && markerLocations.length) {
				const markerLocation = markerLocations[0];
				if (markerLocation) {
					const location = markerLocation.locations[marker.id];
					if (location && location.length) {
						[start, , end] = location!;
						filename = `${marker.file} (Line${start === end ? ` ${start}` : `s ${start}-${end}`})`;
					}
				}
			}

			let url;
			if (
				remotes !== undefined &&
				remotes.length !== 0 &&
				start !== undefined &&
				end !== undefined
			) {
				for (const remote of remotes) {
					url = Marker.getRemoteCodeUrl(
						remote,
						marker.commitHashWhenCreated,
						marker.file,
						start,
						end
					);

					if (url !== undefined) {
						break;
					}
				}
			}

			blocks.push({
				type: "section",
				text: {
					type: "mrkdwn",
					text: `${filename}\n\`\`\`${marker.code}\`\`\``
				}
			});

			let actionId = toReplyActionId(counter, codemark);
			const actions: ActionsBlock = {
				type: "actions",
				block_id: `codeblock-actions:${counter}`,
				elements: [
					{
						type: "button",
						action_id: actionId,
						style: "primary",
						text: {
							type: "plain_text",
							text: "View Discussion & Reply"
						}
					}
				]
			};

			if (codemark.externalProvider !== undefined && codemark.externalProviderUrl !== undefined) {
				actionId = toExternalActionId(counter, "issue", codemark.externalProvider, codemark);
				actions.elements.push({
					type: "button",
					action_id: actionId,
					text: {
						type: "plain_text",
						text: `Open Issue on ${providerNamesById.get(codemark.externalProvider) ||
							codemark.externalProvider}`
					},
					url: codemark.externalProviderUrl
				});
			}

			actionId = toActionId(counter, "ide", codemark, marker);
			actions.elements.push({
				type: "button",
				action_id: actionId,
				text: {
					type: "plain_text",
					text: "Open in IDE"
				},
				url: `${codemark.permalink}?ide=default&marker=${marker.id}`
			});

			if (url !== undefined) {
				actionId = toExternalActionId(counter, "code", url.name, codemark, marker);
				actions.elements.push({
					type: "button",
					action_id: actionId,
					text: {
						type: "plain_text",
						text: `Open on ${url.displayName}`
					},
					url: url.url
				});
			}

			blocks.push(actions);
		}
	} else {
		counter++;

		let actionId = toReplyActionId(counter, codemark);
		const actions: ActionsBlock = {
			type: "actions",
			block_id: "actions",
			elements: [
				{
					type: "button",
					action_id: actionId,
					style: "primary",
					text: {
						type: "plain_text",
						text: "View Discussion & Reply"
					}
				}
			]
		};

		if (codemark.externalProvider !== undefined && codemark.externalProviderUrl !== undefined) {
			actionId = toExternalActionId(counter, "issue", codemark.externalProvider, codemark);
			actions.elements.push({
				type: "button",
				action_id: actionId,
				text: {
					type: "plain_text",
					text: `Open Issue on ${codemark.externalProvider}`
				},
				url: codemark.externalProviderUrl
			});
		}

		actionId = toActionId(counter, "ide", codemark);
		actions.elements.push({
			type: "button",
			action_id: actionId,
			text: {
				type: "plain_text",
				text: "Open in IDE"
			},
			url: `${codemark.permalink}?ide=default`
		});

		blocks.push(actions);
	}

	blocks.push({
		type: "context",
		// MUST keep this data in sync with codemarkAttachmentRegex above
		block_id: `codestream://codemark/${codemark.id}?teamId=${codemark.teamId}`,
		elements: [
			{
				type: "plain_text",
				text: "Posted via CodeStream"
			}
		]
	});

	return blocks;
}

export function toSlackPostText(
	text: string,
	userIdsByName: Map<string, string>,
	mentionedUserIds: string[] | undefined
) {
	if (text == null || text.length === 0) return text;

	text = toSlackText(text, userIdsByName, mentionedUserIds || []);
	if (text.startsWith("/me ")) {
		text = text.substring(4);
	}

	return text;
}

export function toSlackTeam(team: CSTeam, usernamesById: Map<string, string>) {
	team.memberIds = [...usernamesById.keys()];
	// team.memberIds = team.memberIds.map(m => {
	// 	const u = usernamesById.get(m);
	// 	return u !== undefined ? u.id : m;
	// });
}

export function toSlackText(
	text: string,
	userIdsByName: Map<string, string>,
	mentionedUserIds?: string[]
) {
	if (text == null || text.length === 0) return text;

	text = text
		.replace("&", "&amp;")
		.replace("<", "&lt;")
		.replace(">", "&gt;");

	if (
		mentionedUserIds === undefined ||
		mentionedUserIds.length !== 0 ||
		(mentionedUserIds.length === 0 && pseudoMentionsRegex.test(text))
	) {
		text = text.replace(mentionsRegex, (match: string, prefix: string, mentionName: string) => {
			if (mentionName === "everyone" || mentionName === "channel" || mentionName === "here") {
				return `${prefix}<!${mentionName}>`;
			}

			if (mentionedUserIds === undefined || mentionedUserIds.length !== 0) {
				const userId = userIdsByName.get(mentionName);
				if (
					userId !== undefined &&
					(mentionedUserIds === undefined || mentionedUserIds.includes(userId))
				) {
					return `${prefix}<@${userId}>`;
				}
			}

			return match;
		});
	}

	return text;
}
