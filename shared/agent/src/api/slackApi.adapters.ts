"use strict";
import { MessageAttachment } from "@slack/client";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	CSChannelStream,
	CSCodeBlock,
	CSDirectStream,
	CSPost,
	CSTeam,
	CSUser,
	StreamType
} from "../shared/api.protocol";

const defaultCreatedAt = 165816000000;
// const multiPartyNamesRegEx = /^mpdm-([^-]+)(--.*)-1$/;
// const multiPartyNameRegEx = /--([^-]+)/g;

const mentionsRegex = /(^|\s)@(\w+)(?:\b(?!@|[\(\{\[\<\-])|$)/g;
const slackMentionsRegex = /\<[@|!](\w+)\>/g;
const slackChannelsRegex = /\<#(\w+)\|(\w+)\>/g;
const markerAttachmentRegex = /codestream\:\/\/marker\/(.*)/;

export function fromSlackChannelOrDirect(
	channel: any,
	usersById: Map<string, CSUser>,
	slackUserId: string,
	codestreamTeamId: string
) {
	if (channel.is_channel || (channel.is_group && !channel.is_mpim)) {
		return fromSlackChannel(channel, usersById, slackUserId, codestreamTeamId);
	}

	if (channel.is_mpim || channel.is_im) {
		return fromSlackDirect(channel, usersById, slackUserId, codestreamTeamId);
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
	usersById: Map<string, CSUser>,
	slackUserId: string,
	codestreamTeamId: string
): CSChannelStream {
	const { mostRecentId, mostRecentTimestamp } = fromSlackChannelOrDirectLatest(channel);

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

export function fromSlackDirect(
	channel: any,
	usersById: Map<string, CSUser>,
	slackUserId: string,
	codestreamTeamId: string
): CSDirectStream {
	const { mostRecentId, mostRecentTimestamp } = fromSlackChannelOrDirectLatest(channel);

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

	let names: string[];
	if (channel.members != null) {
		names = channel.members.filter((m: string) => m !== slackUserId).map((m: string) => {
			const user = usersById.get(m);
			return user === undefined ? m : user.username || m;
		});
		names.sort((a, b) => a.localeCompare(b));
	} else {
		names = ["Unknown"];
	}

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

export async function fromSlackPost(
	post: any,
	streamId: string,
	usersById: Map<string, CSUser>,
	teamId: string
): Promise<CSPost> {
	const mentionedUserIds: string[] = [];

	let text = fromSlackPostText(post, usersById, mentionedUserIds);

	let reactions;
	if (post.reactions) {
		reactions = Object.create(null);
		for (const reaction of post.reactions) {
			reactions[reaction.name] = reaction.users;
		}
	}

	let codeBlocks: CSCodeBlock[] | undefined;
	let commitHashWhenPosted;
	if (post.attachments && post.attachments.length !== 0) {
		// Filter out unfurled links
		// TODO: Turn unfurled images into files
		const attachments = post.attachments.filter((a: any) => a.from_url == null);
		if (attachments.length !== 0) {
			const blocks = await fromSlackPostCodeBlock(attachments);
			if (blocks) {
				({ codeBlocks, commitHashWhenPosted } = blocks);
			} else {
				// Get text/fallback for attachments
				text += "\n";
				for (const attachment of attachments) {
					text += `\n${attachment.text || attachment.fallback}`;
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
		codeBlocks: codeBlocks,
		commitHashWhenPosted: commitHashWhenPosted,
		createdAt: timestamp,
		creatorId: post.user || (post.bot_id && post.username),
		deactivated: false,
		files: files,
		hasBeenEdited: post.edited != null,
		hasReplies: post.ts === post.thread_ts,
		id: toSlackPostId(post.ts, streamId),
		mentionedUserIds: mentionedUserIds,
		modifiedAt: timestamp,
		parentPostId: post.thread_ts ? toSlackPostId(post.thread_ts, streamId) : post.thread_ts,
		reactions: reactions,
		text: text,
		seqNum: post.ts,
		streamId: streamId,
		teamId: teamId
	};
}

export async function fromSlackPostCodeBlock(attachments: MessageAttachment[]) {
	const attachment = attachments.find(
		(a: any) => a.callback_id != null && markerAttachmentRegex.test(a.callback_id)
	);
	if (attachment == null) return undefined;

	const match = markerAttachmentRegex.exec(attachment.callback_id || "");
	if (match == null) return undefined;

	const [, markerId] = match;

	let marker;
	try {
		marker = await Container.instance().markers.getById(markerId);
	} catch (ex) {
		Logger.error(ex, `Failed to find marker=${markerId}`);
		return undefined;
	}

	if (marker.codeBlock == null) return undefined;

	const { code, commitHash, file, repoId, streamId } = marker.codeBlock;
	return {
		commitHashWhenPosted: commitHash,
		codeBlocks: [
			{
				code: code,
				file: file,
				repoId: repoId,
				markerId: marker.id,
				streamId: streamId
			}
		]
	};
}

export function fromSlackPostFile(file: any) {
	const image = file.mimetype.startsWith("image/");

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

export function toSlackPostId(postId: string, streamId: string) {
	return `${streamId}|${postId}`;
}

export function fromSlackPostText(
	post: any,
	usersById: Map<string, CSUser>,
	mentionedUserIds: string[]
): string {
	if (!post.text) return post.text || "";

	let text = post.text
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
		.replace(slackChannelsRegex, (match: string, channel: string, name: string) => {
			return `#${name}`;
		})
		// Slack always encodes < & > so decode them
		.replace("&lt;", "<")
		.replace("&gt;", ">");

	if (post.subtype === "me_message") {
		text = `/me ${text}`;
	}

	return text;
}

export function toSlackPostText(
	text: string,
	mentionedUserIds: string[] | undefined,
	usersByName: Map<string, CSUser>
) {
	if (mentionedUserIds != null && mentionedUserIds.length !== 0) {
		text = text.replace(mentionsRegex, (match: string, prefix: string, mentionName: string) => {
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

	if (text.startsWith("/me ")) {
		return text.substring(4);
	}

	return text;
}

export function toSlackTeam(team: CSTeam, usersById: Map<string, CSUser>) {
	team.memberIds = [...usersById.keys()];
	// team.memberIds = team.memberIds.map(m => {
	// 	const u = usersById.get(m);
	// 	return u !== undefined ? u.id : m;
	// });
}

export function fromSlackUser(user: any, teamId: string): CSUser {
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
