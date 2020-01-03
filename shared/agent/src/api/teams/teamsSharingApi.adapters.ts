"use strict";
import { IAdaptiveCard, ITextBlock } from "adaptivecards/lib/schema";
import { CodemarkPlus } from "protocol/agent.protocol";
import { SessionContainer } from "../../container";
import {
	CodemarkType,
	CSChannelStream,
	CSMarkerLocations,
	CSPost,
	CSTeam,
	CSUser,
	StreamType
} from "../../protocol/api.protocol";
import { providerNamesById } from "../../providers/provider";
import { Strings } from "../../system";
import { Marker } from "../extensions";

const defaultCreatedAt = 181886400000;
const defaultCreator = "0";

const mentionsRegex = /(^|\s)@(\w+)(?:\b(?!@|[\(\{\[\<\-])|$)/g;
const pseudoMentionsRegex = /(^|\s)@(everyone|channel|here)(?:\b(?!@|[\(\{\[\<\-])|$)/g;

const teamsAttachmentsRegex = /<attachment id=\\?"(.+?)\\?"><\/attachment>/g;
const teamsMainAttachmentRegex = /<attachment id=\\?"main\|(.+?)\\?"><\/attachment>/;
const teamsMentionsRegex = /<at id=\\?"(\d+)\\?">(.+)<\/at>/g;

// This doesn't work 100% for Teams, but its better than nothing
const preserveWhitespaceRegex = /((?<!\n)\n(?!=\n))/g;

export interface UserInfo {
	username: string;
	displayName: string;
	type: string;
}

interface TeamsAdaptiveCard extends IAdaptiveCard {
	$schema: "http://adaptivecards.io/schemas/adaptive-card.json";
	id: string;
}

interface TeamsHeroCard {
	id: string;
	title?: string;
	subtitle?: string;
	text?: string;
	images?: { url: string }[];
	buttons?: { type: "openUrl"; title: string; value: string }[];
}


export interface TeamsMessageAttachment {
	contentType:
		| "application/vnd.microsoft.card.hero"
		| "application/vnd.microsoft.card.thumbnail"
		| "application/vnd.microsoft.card.adaptive";
	content: string;
	id: string;
}

export interface TeamsMessageBody {
	contentType: "text" | "html";
	content: string;
}

export interface TeamsMessageMention {
	id: number;
	mentionText: string;
	mentioned: {
		user: {
			displayName: string;
			id: string;
			userIdentityType: string;
		};
	};
}

export interface GraphBatchRequest {
	id: string;
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | string;
	url: string;
}

export interface GraphBatchResponse {
	id: string;
	status: number;
	headers?: {
		location: string;
	};
	body?: {
		"@odata.context": string;
		error?: {
			code: string;
			message: string;
		};
		value?: any[];
	} | null;
}

export function fromPostId(
	postId: string | undefined,
	streamId: string
): { teamId: string; channelId: string; messageId: string | undefined } {
	if (postId == null) return { ...fromStreamId(streamId), messageId: postId };

	return JSON.parse(postId);
}

export function toPostId(messageId: string, channelId: string, teamId: string) {
	return JSON.stringify({ teamId: teamId, channelId: channelId, messageId: messageId });
}

export function fromStreamId(streamId: string): { teamId: string; channelId: string } {
	return JSON.parse(streamId);
}

export function toStreamId(channelId: string, teamId: string) {
	return JSON.stringify({ teamId: teamId, channelId: channelId });
}

export async function fromTeamsMessage(
	message: any,
	channelId: string,
	teamId: string,
	userInfosById: Map<string, UserInfo>,
	codeStreamTeamId: string,
	replyCount?: number
): Promise<CSPost> {
	const mentionedUserIds: string[] = [];

	let text;
	if (message.deletedDateTime == null) {
		text = fromTeamsMessageText(message, userInfosById, message.mentions, mentionedUserIds);
	} else {
		text = `_This ${message.replyToId == null ? "message" : "reply"} has been deleted._`;
	}

	// let reactions;
	// if (post.reactions) {
	// 	reactions = Object.create(null);
	// 	for (const reaction of post.reactions) {
	// 		reactions[reaction.name] = reaction.users;
	// 	}
	// }

	// let codemark: CSCodemark | undefined;
	// if (post.attachments && post.attachments.length !== 0) {
	// 	// Filter out unfurled links
	// 	// TODO: Turn unfurled images into files
	// 	const attachments = post.attachments.filter((a: any) => a.from_url == null);
	// 	if (attachments.length !== 0) {
	// 		codemark = await fromSlackPostCodemark(attachments, teamId);
	// 		if (!codemark) {
	// 			// legacy markers
	// 			const marker = await fromSlackPostMarker(attachments);
	// 			if (marker) {
	// 				codemark = await Container.instance().codemarks.getById(marker.codemarkId);
	// 			}
	// 		}
	// 		if (!codemark) {
	// 			// Get text/fallback for attachments
	// 			text += "\n";
	// 			for (const attachment of attachments) {
	// 				text += `\n${attachment.text || attachment.fallback}`;
	// 			}
	// 		}
	// 	}
	// }

	// let files;
	// if (post.files && post.files.length !== 0) {
	// 	files = post.files.map(fromSlackPostFile);
	// }

	const postId = toPostId(message.id, channelId, teamId);

	let codemarkId;
	const match = teamsMainAttachmentRegex.exec(message.body.content);
	if (match != null) {
		[, codemarkId] = match;
	} else {
		codemarkId = await SessionContainer.instance().codemarks.getIdByPostId(postId);
	}

	const timestamp = new Date(message.createdDateTime).getTime();
	const modifiedTimestamp = new Date(
		message.lastModifiedDateTime || message.createdDateTime
	).getTime();
	return {
		codemarkId: codemarkId,
		createdAt: timestamp,
		creatorId: (message.from.user && message.from.user.id) || "codestream",
		deactivated: message.deleted,
		// files: files,
		hasBeenEdited: timestamp !== modifiedTimestamp,
		numReplies: replyCount || 0,
		id: postId,
		mentionedUserIds: mentionedUserIds,
		modifiedAt: modifiedTimestamp,
		parentPostId: message.replyToId ? toPostId(message.replyToId, channelId, teamId) : undefined,
		// reactions: reactions,
		text: text,
		seqNum: message.id,
		streamId: toStreamId(channelId, teamId),
		teamId: codeStreamTeamId
	};
}

export function toTeamsMessageBody(
	codemark: CodemarkPlus,
	remotes: string[] | undefined,
	mentionedUserIds: string[] | undefined,
	userInfosById: Map<string, UserInfo>,
	userIdsByName: Map<string, string>,
	mentionsOut: TeamsMessageMention[],
	attachmentsOut: TeamsMessageAttachment[]
): { contentType: "text" | "html"; content: string } {
	const mainCard: TeamsAdaptiveCard = {
		$schema: "http://adaptivecards.io/schemas/adaptive-card.json",
		type: "AdaptiveCard",
		version: "1.0",
		// Must keep this ID in sync with `teamsMainAttachmentRegex` above
		id: `main|${codemark.id}`,
		spacing: "none",
		body: []
	};

	// Add any mentions to a preamble, because mentions aren't supported in attachments
	let mentions;
	let preamble = "";
	if (mentionedUserIds != null && mentionedUserIds.length !== 0) {
		mentions = `${mentionedUserIds.map(u => `@${userInfosById.get(u)!.username}`).join(", ")}: `;
		preamble = toTeamsText(mentions, mentionedUserIds, userInfosById, userIdsByName, mentionsOut);
	}

	const items: ITextBlock[] = [];
	let actionType = "";

	switch (codemark.type) {
		case CodemarkType.Comment:
		case CodemarkType.Trap: {
			actionType = "<i>commented on code</i>";
			// Remove any duplicate mentions at the start of the text
			let text = codemark.text;
			if (mentions && text.startsWith(mentions)) {
				text = text.substr(mentions.length - 1);
			}

			items.push({
				type: "TextBlock",
				text: text.replace(preserveWhitespaceRegex, "\n\n"),
				wrap: true
			});

			break;
		}
		case CodemarkType.Bookmark: {
			actionType = "<i>set a bookmark</i>";
			items.push({
				type: "TextBlock",
				// Bookmarks use the title rather than text
				text: codemark.title,
				wrap: true
			});

			break;
		}
		case CodemarkType.Issue:
		case CodemarkType.Question: {
			actionType = "<i>opened an issue</i>";
			if (codemark.title) {
				items.push({
					type: "TextBlock",
					text: codemark.title,
					weight: "bolder",
					wrap: true
				});
			}

			if (codemark.text) {
				// Remove any duplicate mentions at the start of the text
				let text = codemark.text;
				if (mentions && text.startsWith(mentions)) {
					text = text.substr(mentions.length - 1);
				}

				items.push({
					type: "TextBlock",
					text: text.replace(preserveWhitespaceRegex, "\n\n"),
					spacing: "none",
					wrap: true
				});
			}

			break;
		}
	}

	const attachments: TeamsMessageAttachment[] = [];

	if (codemark.assignees !== undefined && codemark.assignees.length !== 0) {
		items.push(
			{
				type: "TextBlock",
				text: "Assignees",
				weight: "bolder"
			},
			{
				type: "TextBlock",
				text: codemark.assignees
					.map(a => {
						const user = userInfosById.get(a);
						return user ? user.displayName : "";
					})
					.join(", "),
				spacing: "none"
			}
		);
	}

	if (
		codemark.externalProvider !== undefined &&
		codemark.externalAssignees !== undefined &&
		codemark.externalAssignees.length !== 0
	) {
		items.push(
			{
				type: "TextBlock",
				text: "Assignees",
				weight: "bolder"
			},
			{
				type: "TextBlock",
				text: codemark.externalAssignees.map(a => a.displayName).join(", "),
				spacing: "none"
			}
		);
	}

	if (codemark.markers !== undefined && codemark.markers.length !== 0) {
		for (const marker of codemark.markers) {
			let filename = marker.file;
			let start;
			let end;

			if (marker.referenceLocations && marker.referenceLocations.length) {
				const markerLocation = marker.referenceLocations.find(m => m.commitHash === marker.commitHashWhenCreated) || marker.referenceLocations[0];
				if (markerLocation) {
					const location = markerLocation.location;
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

			// Can't use an AdaptiveCard here, because they don't allow code block formatting
			const markerCard: TeamsHeroCard = {
				id: `marker|${codemark.id}|${marker.id}`,
				subtitle: filename,
				text: `<code style="white-space:pre;display:block;overflow:auto;">${Strings.escapeHtml(
					marker.code
				)}</code>`,
				buttons: []
			};

			markerCard.buttons!.push({
				type: "openUrl",
				title: "Open on Web",
				value: `${codemark.permalink}?marker=${marker.id}`
			});

			if (codemark.externalProvider !== undefined && codemark.externalProviderUrl !== undefined) {
				markerCard.buttons!.push({
					type: "openUrl",
					title: `Open Issue on ${providerNamesById.get(codemark.externalProvider) ||
						codemark.externalProvider}`,
					value: codemark.externalProviderUrl
				});
			}

			markerCard.buttons!.push({
				type: "openUrl",
				title: "Open in IDE",
				value: `${codemark.permalink}?ide=default&marker=${marker.id}`
			});
			if (url !== undefined) {
				markerCard.buttons!.push({
					type: "openUrl",
					title: `Open on ${url.displayName}`,
					value: url.url
				});
			}

			attachments.push({
				id: markerCard.id!,
				contentType: "application/vnd.microsoft.card.hero",
				content: JSON.stringify(markerCard)
			});
		}
	} else {
		mainCard.buttons!.push({
			type: "openUrl",
			title: "Open on Web",
			value: codemark.permalink
		});

		if (codemark.externalProvider !== undefined && codemark.externalProviderUrl !== undefined) {
			mainCard.buttons!.push({
				type: "openUrl",
				title: `Open Issue on ${providerNamesById.get(codemark.externalProvider) ||
					codemark.externalProvider}`,
				value: codemark.externalProviderUrl
			});
		}

		mainCard.buttons!.push({
			type: "openUrl",
			title: "Open in IDE",
			value: `${codemark.permalink}?ide=default`
		});
	}

	mainCard.body!.push({
		type: "Container",
		spacing: "none",
		style: "default",
		items: items
	});

	// Set the fallback (notification) content for the message
	mainCard.fallbackText = `${codemark.title || ""}${
		codemark.title && codemark.text ? `\n\n` : ""
	}${codemark.text || ""}`;

	attachments.splice(0, 0, {
		id: mainCard.id!,
		contentType: "application/vnd.microsoft.card.adaptive",
		content: JSON.stringify(mainCard)
	});
	attachmentsOut.push(...attachments);
	if (!preamble) {
		preamble = actionType;
	}
	return {
		contentType: "html",
		content: `${preamble}${attachments.map(c => `<attachment id="${c.id}"></attachment>`).join("")}`
	};
}

export function fromTeamsMessageText(
	message: any,
	userInfosById: Map<string, UserInfo>,
	mentions: TeamsMessageMention[] | undefined,
	mentionedUserIds: string[]
): string {
	if (!message.body) return message.summary || message.subject || "";

	let text = message.body.content.replace(teamsAttachmentsRegex, "");

	if (mentions === undefined || mentions.length === 0) return text;

	text = text.replace(teamsMentionsRegex, (match: string, id: string, mentionText: string) => {
		const mention = mentions.find(m => m.id === Number(id));
		if (mention !== undefined) {
			mentionedUserIds.push(mention.mentioned.user.id);
			const userInfo = userInfosById.get(mention.mentioned.user.id);
			return `@${(userInfo && userInfo.username) || mentionText}`;
		}

		return `@${mentionText}`;
	});
	return text;
}

export function toTeamsText(
	text: string,
	mentionedUserIds: string[] | undefined,
	userInfosById: Map<string, UserInfo>,
	userIdsByName: Map<string, string>,
	mentionsOut: TeamsMessageMention[],
	skipMentionLinking: boolean = false
) {
	if (text == null || text.length === 0) return text;

	const hasMentionedUsers = mentionedUserIds != null && mentionedUserIds.length !== 0;
	if (hasMentionedUsers || pseudoMentionsRegex.test(text)) {
		text = text.replace(mentionsRegex, (match: string, prefix: string, mentionName: string) => {
			if (mentionName === "everyone" || mentionName === "channel" || mentionName === "here") {
				return `${prefix}<!${mentionName}>`;
			}

			if (hasMentionedUsers) {
				const userId = userIdsByName.get(mentionName);
				if (userId !== undefined && mentionedUserIds!.includes(userId)) {
					const id = mentionsOut.length;

					const userInfo = userInfosById.get(userId);
					if (userInfo !== undefined && !skipMentionLinking) {
						mentionsOut.push({
							id: id,
							mentionText: mentionName,
							mentioned: {
								user: {
									displayName: userInfo.displayName,
									id: userId,
									userIdentityType: userInfo.type
								}
							}
						});
					}

					return skipMentionLinking
						? `${prefix}${mentionName}`
						: `${prefix}<at id="${id}">${mentionName}</at>`;
				}
			}

			return match;
		});
	}

	return text;
}

export function fromTeamsChannel(
	channel: any,
	teamId: string,
	teamsUserId: string,
	codestreamTeamId: string,
	teamsById: Map<string, string>
): CSChannelStream {
	let memberIds: string[] | undefined;
	if (channel.displayName !== "General") {
		// TODO: If we are missing membership, what should we do?
		// Add an isMember propery to the stream and keep members undefined ?
		memberIds = channel.members == null ? [teamsUserId] : channel.members;
	}

	const name =
		teamsById.size === 1
			? channel.displayName || ""
			: `${teamsById.get(teamId)}: ${channel.displayName || ""}`;

	return {
		createdAt: defaultCreatedAt,
		creatorId: defaultCreator,
		id: toStreamId(channel.id, teamId),
		isArchived: false,
		isTeamStream: channel.displayName === "General",
		name: name,
		memberIds: memberIds,
		modifiedAt: defaultCreatedAt,
		priority: 0,
		privacy: "public",
		purpose: channel.description || "",
		sortId: undefined!,
		teamId: codestreamTeamId,
		type: StreamType.Channel
	};
}

export function toTeamsTeam(team: CSTeam, userInfosById: Map<string, UserInfo>) {
	team.memberIds = [...userInfosById.keys()];
	// team.memberIds = team.memberIds.map(m => {
	// 	const u = userInfosById.get(m);
	// 	return u !== undefined ? u.id : m;
	// });
}

export function fromTeamsUser(
	user: any,
	codestreamTeamId: string,
	codestreamUsers: CSUser[]
): CSUser {
	let codestreamId: string | undefined;
	if (codestreamUsers.length !== 0) {
		const identity = `msteams::${user.id}`;
		const u = codestreamUsers.find(m =>
			m.providerIdentities == null ? false : m.providerIdentities.includes(identity)
		);
		if (u !== undefined) {
			codestreamId = u.id;
		}
	}

	return {
		avatar: undefined,
		companyIds: [],
		createdAt: defaultCreatedAt, // user.createdDateTime on me
		creatorId: user.id,
		deactivated: user.deletedDateTime != null,
		email: user.mail || `cs-${user.id}@unknown.com`,
		firstName: user.givenName,
		fullName: user.displayName,
		id: user.id,
		codestreamId: codestreamId,
		isRegistered: codestreamId !== undefined,
		iWorkOn: undefined,
		lastPostCreatedAt: defaultCreatedAt,
		lastName: user.surname,
		modifiedAt: defaultCreatedAt,
		numInvites: 0,
		numMentions: 0,
		registeredAt: defaultCreatedAt,
		// TODO: Need to hold both codestream and teams teams?
		teamIds: [codestreamTeamId],
		timeZone: "",
		// TODO: ???
		totalPosts: 0,
		username: user.displayName.replace(/ /g, "_")
	};
}
