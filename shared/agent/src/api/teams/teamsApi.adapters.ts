"use strict";
import { IAdaptiveCard, IColumn, ITextBlock } from "adaptivecards/lib/schema";
import { SessionContainer } from "../../container";
import {
	CodemarkType,
	CSChannelStream,
	CSCodemark,
	CSMarker,
	CSMarkerLocations,
	CSPost,
	CSTeam,
	CSUser,
	StreamType
} from "../../protocol/api.protocol";
import { providerNamesById } from "../../providers/provider";
import { Strings } from "../../system";
import { Marker, toActionId, toExternalActionId } from "../extensions";

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

interface TeamsThumbnailCard {
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
	codemark: CSCodemark,
	remotes: string[] | undefined,
	markers: CSMarker[] | undefined,
	markerLocations: CSMarkerLocations[] | undefined,
	mentionedUserIds: string[] | undefined,
	userInfosById: Map<string, UserInfo>,
	userIdsByName: Map<string, string>,
	mentionsOut: TeamsMessageMention[],
	attachmentsOut: TeamsMessageAttachment[]
): { contentType: "text" | "html"; content: string } {
	let preamble: string | undefined;

	const mainCard: TeamsAdaptiveCard = {
		$schema: "http://adaptivecards.io/schemas/adaptive-card.json",
		type: "AdaptiveCard",
		version: "1.0",
		// Must keep this ID in sync with `teamsMainAttachmentRegex` above
		id: `main|${codemark.id}`,
		body: []
	};

	switch (codemark.type) {
		case CodemarkType.Comment: {
			preamble = "<i>commented on code</i>";

			const text: ITextBlock = {
				type: "TextBlock",
				text: codemark.text.replace(preserveWhitespaceRegex, "\n\n"),
				size: "medium",
				wrap: true
			};

			mainCard.body!.push({
				type: "Container",
				bleed: true,
				items: [text]
			});

			break;
		}
		case CodemarkType.Bookmark: {
			preamble = "<i>set a bookmark</i>";

			const text: ITextBlock = {
				type: "TextBlock",
				// Bookmarks use the title rather than text
				text: codemark.title,
				size: "medium",
				wrap: true
			};

			mainCard.body!.push({
				type: "Container",
				items: [text]
			});

			break;
		}
		case CodemarkType.Issue: {
			preamble = "<i>opened an issue</i>";

			const items: ITextBlock[] = [];

			if (codemark.title) {
				const title: ITextBlock = {
					type: "TextBlock",
					text: codemark.title,
					weight: "bolder",
					size: "large",
					wrap: true
				};
				items.push(title);
			}

			if (codemark.text) {
				const text: ITextBlock = {
					type: "TextBlock",
					text: codemark.text.replace(preserveWhitespaceRegex, "\n\n"),
					size: "medium",
					wrap: true
				};
				items.push(text);
			}

			mainCard.body!.push({
				type: "Container",
				items: items
			});

			break;
		}
		case CodemarkType.Question: {
			preamble = "<i>has a question</i>";

			const items: ITextBlock[] = [];

			if (codemark.title) {
				const title: ITextBlock = {
					type: "TextBlock",
					text: codemark.title,
					weight: "bolder",
					size: "large",
					wrap: true
				};
				items.push(title);
			}

			if (codemark.text) {
				const text: ITextBlock = {
					type: "TextBlock",
					text: codemark.text.replace(preserveWhitespaceRegex, "\n\n"),
					size: "medium",
					wrap: true
				};
				items.push(text);
			}

			mainCard.body!.push({
				type: "Container",
				items: items
			});

			break;
		}
		case CodemarkType.Trap: {
			preamble = "<i>set a trap</i>";

			const text: ITextBlock = {
				type: "TextBlock",
				text: codemark.text.replace(preserveWhitespaceRegex, "\n\n"),
				size: "medium",
				wrap: true
			};

			mainCard.body!.push({
				type: "Container",
				items: [text]
			});

			break;
		}
	}

	const attachments: TeamsMessageAttachment[] = [];

	if (codemark.assignees !== undefined && codemark.assignees.length !== 0) {
		const assigneesCard: TeamsAdaptiveCard = {
			$schema: "http://adaptivecards.io/schemas/adaptive-card.json",
			type: "AdaptiveCard",
			version: "1.0",
			id: `assignees|${codemark.id}`,
			body: []
		};

		const title: ITextBlock = {
			type: "TextBlock",
			text: "Assignees",
			size: "large",
			weight: "bolder"
		};

		const column1: IColumn = {
			type: "Column",
			width: "stretch",
			items: []
		};

		const column2: IColumn = {
			type: "Column",
			width: "stretch",
			items: []
		};

		assigneesCard.body!.push({
			type: "Container",
			spacing: "large",
			items: [
				title,
				{
					type: "ColumnSet",
					columns: [column1, column2]
				}
			]
		});

		let assignee;
		let text: ITextBlock;
		let user;
		let useFirst = true;
		for (assignee of codemark.assignees) {
			user = userInfosById.get(assignee);
			if (user === undefined) continue;

			text = {
				type: "TextBlock",
				text: user.displayName,
				wrap: true
			};

			if (useFirst) {
				column1.items!.push(text);
			} else {
				column2.items!.push(text);
			}

			useFirst = !useFirst;
		}

		attachments.push({
			id: assigneesCard.id!,
			contentType: "application/vnd.microsoft.card.adaptive",
			content: JSON.stringify(assigneesCard)
		});
	}

	if (
		codemark.externalProvider !== undefined &&
		codemark.externalAssignees !== undefined &&
		codemark.externalAssignees.length !== 0
	) {
		const assigneesCard: TeamsAdaptiveCard = {
			$schema: "http://adaptivecards.io/schemas/adaptive-card.json",
			type: "AdaptiveCard",
			version: "1.0",
			id: `assignees|${codemark.id}`,
			body: []
		};

		const title: ITextBlock = {
			type: "TextBlock",
			text: "Assignees",
			size: "large",
			weight: "bolder"
		};

		const column1: IColumn = {
			type: "Column",
			width: "stretch",
			items: []
		};

		const column2: IColumn = {
			type: "Column",
			width: "stretch",
			items: []
		};

		assigneesCard.body!.push({
			type: "Container",
			spacing: "large",
			items: [
				title,
				{
					type: "ColumnSet",
					columns: [column1, column2]
				}
			]
		});

		let assignee;
		let text: ITextBlock;
		let useFirst = true;
		for (assignee of codemark.externalAssignees) {
			text = {
				type: "TextBlock",
				text: assignee.displayName,
				wrap: true
			};

			if (useFirst) {
				column1.items!.push(text);
			} else {
				column2.items!.push(text);
			}

			useFirst = !useFirst;
		}

		attachments.push({
			id: assigneesCard.id!,
			contentType: "application/vnd.microsoft.card.adaptive",
			content: JSON.stringify(assigneesCard)
		});
	}

	if (markers !== undefined && markers.length !== 0) {
		let filename;
		let start;
		let end;

		for (const marker of markers) {
			if (markerLocations) {
				const location = markerLocations[0].locations[marker.id];
				[start, , end] = location!;
				filename = `${marker.file} (Line${start === end ? ` ${start}` : `s ${start}-${end}`})`;
			} else {
				filename = marker.file;
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
				title: "Open on CodeStream",
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
		const actionsCard: TeamsAdaptiveCard = {
			$schema: "http://adaptivecards.io/schemas/adaptive-card.json",
			type: "AdaptiveCard",
			version: "1.0",
			id: `actions|${codemark.id}`,
			actions: []
		};

		let actionId = toActionId(1, "web", codemark);
		actionsCard.actions!.push({
			type: "Action.OpenUrl",
			id: actionId,
			title: "Open on CodeStream",
			url: codemark.permalink
		});

		if (codemark.externalProvider !== undefined && codemark.externalProviderUrl !== undefined) {
			actionId = toExternalActionId(1, "issue", codemark.externalProvider, codemark);
			actionsCard.actions!.push({
				type: "Action.OpenUrl",
				id: actionId,
				title: `Open Issue on ${providerNamesById.get(codemark.externalProvider) ||
					codemark.externalProvider}`,
				url: codemark.externalProviderUrl
			});
		}

		actionId = toActionId(1, "ide", codemark);
		actionsCard.actions!.push({
			type: "Action.OpenUrl",
			id: actionId,
			title: "Open in IDE",
			url: `${codemark.permalink}?ide=default`
		});

		attachments.push({
			id: actionsCard.id!,
			contentType: "application/vnd.microsoft.card.adaptive",
			content: JSON.stringify(actionsCard)
		});
	}

	if (preamble) {
		// Add any mentions onto the preamble, because mentions aren't supported in attachments
		if (mentionedUserIds != null && mentionedUserIds.length !== 0) {
			preamble += `  /cc ${mentionedUserIds
				.map(u => `@${userInfosById.get(u)!.username}`)
				.join(", ")}`;
		}

		preamble = toTeamsText(preamble, mentionedUserIds, userInfosById, userIdsByName, mentionsOut);
	}

	attachments.splice(0, 0, {
		id: mainCard.id!,
		contentType: "application/vnd.microsoft.card.adaptive",
		content: JSON.stringify(mainCard)
	});
	attachmentsOut.push(...attachments);

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
