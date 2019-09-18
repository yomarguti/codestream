"use strict";
import { Marker } from "../../api/extensions";
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

const defaultCreatedAt = 181886400000;
const defaultCreator = "0";

const mentionsRegex = /(^|\s)@(\w+)(?:\b(?!@|[\(\{\[\<\-])|$)/g;
const pseudoMentionsRegex = /(^|\s)@(everyone|channel|here)(?:\b(?!@|[\(\{\[\<\-])|$)/g;

const teamsAttachmentsRegex = /<attachment id=\\?"(.+?)\\?"><\/attachment>/g;
const teamsMentionsRegex = /<at id=\\?"(\d+)\\?">(.+)<\/at>/g;

export interface UserInfo {
	username: string;
	displayName: string;
	type: string;
}

export interface TeamsMessageAttachmentButton {
	type: string;
	title: string;
	text: string;
	displayText: string;
	value: string;
}

export interface TeamsMessageAttachment {
	id: string;
	contentType: "application/vnd.microsoft.card.thumbnail";
	contentUrl?: string;
	content?: string;
	name?: string;
	thumbnailUrl?: string;
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
	const codemarkId = await SessionContainer.instance().codemarks.getIdByPostId(postId);

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
	teamsUserId: string,
	mentionsOut: TeamsMessageMention[],
	attachmentsOut: TeamsMessageAttachment[]
): { contentType: "text" | "html"; content: string } {
	let { color } = codemark;
	if (color !== undefined) {
		switch (color) {
			case "blue":
				color = "#3578ba";
				break;
			case "green":
				color = "#7aba5d";
				break;
			case "yellow":
				color = "#edd648";
				break;
			case "orange":
				color = "#f1a340";
				break;
			case "red":
				color = "#d9634f";
				break;
			case "purple":
				color = "#b87cda";
				break;
			case "aqua":
				color = "#5abfdc";
				break;
			case "gray":
			default:
				color = "#888888";
				break;
		}
	}

	let message;
	let fields:
		| {
				title?: string;
				value: string;
				short?: boolean;
		  }[]
		| undefined;
	let text;
	let title;

	switch (codemark.type) {
		case CodemarkType.Comment:
			message = "<i>commented on code</i>";
			text = codemark.text;

			break;
		case CodemarkType.Bookmark:
			message = "<i>set a bookmark";
			// Bookmarks use the title rather than text
			text = codemark.title;

			break;
		case CodemarkType.Issue:
			message = "<i>opened an issue";
			title = codemark.title;
			text = codemark.text;

			break;
		case CodemarkType.Question:
			message = "<i>has a question";
			title = codemark.title;
			text = codemark.text;

			break;
		case CodemarkType.Trap:
			message = "<i>set a trap";
			text = codemark.text;

			break;
	}

	if (codemark.assignees !== undefined && codemark.assignees.length !== 0) {
		if (fields === undefined) {
			fields = [];
		}

		fields.push({
			title: "Assignees",
			value: codemark.assignees
				.map(a => {
					const u = userInfosById.get(a);
					return (u && u.displayName) || "Someone";
				})
				.join(", ")
		});
	}

	if (
		codemark.externalProvider !== undefined &&
		codemark.externalAssignees !== undefined &&
		codemark.externalAssignees.length !== 0
	) {
		if (fields === undefined) {
			fields = [];
		}

		fields.push({
			title: "Assignees",
			value: codemark.externalAssignees.map(a => a.displayName).join(", ")
		});
	}

	const buttons = [];

	if (markers !== undefined && markers.length !== 0) {
		if (fields === undefined) {
			fields = [];
		}

		for (const marker of markers) {
			let filename;
			let start;
			let end;

			if (markerLocations) {
				const location = markerLocations[0].locations[marker.id];
				[start, , end] = location!;
				filename = `<span style="display:inline-block;padding-top:1rem;">${marker.file} (Line${
					start === end ? ` ${start}` : `s ${start}-${end}`
				})</span>`;
			} else {
				filename = `<span style="display:inline-block;padding-top:1rem;">${marker.file}</span>`;
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

			fields.push({
				title: undefined,
				value: `${filename}<code style="margin:7px 0;padding:10px;border:1px solid #d9d9d9;white-space:pre;display:block;overflow:auto;">${marker.code}</code>`
			});

			// Since MSTeams only allows a max of 6 buttons, only add the Open on CodeStream & Open Issue on X buttons to the first code block
			if (buttons.length < 2) {
				buttons.push({
					type: "openUrl",
					title: "Open on CodeStream",
					value: `${codemark.permalink}?marker=${marker.id}`
				});

				if (codemark.externalProvider !== undefined && codemark.externalProviderUrl !== undefined) {
					buttons.push({
						type: "openUrl",
						title: `Open Issue on ${providerNamesById.get(codemark.externalProvider) ||
							codemark.externalProvider}`,
						value: codemark.externalProviderUrl
					});
				}
			}

			// MSTeams only allows a max of 6 buttons
			if (buttons.length < 6) {
				buttons.push({
					type: "openUrl",
					title: "Open in IDE",
					value: `${codemark.permalink}?ide=default&marker=${marker.id}`
				});
			}

			// MSTeams only allows a max of 6 buttons
			if (buttons.length < 6) {
				if (url !== undefined) {
					buttons.push({
						type: "openUrl",
						title: `Open on ${url.displayName}`,
						value: url.url
					});
				}
			}
		}
	} else {
		buttons.push({
			type: "openUrl",
			title: "Open on CodeStream",
			value: codemark.permalink
		});

		if (codemark.externalProvider !== undefined && codemark.externalProviderUrl !== undefined) {
			buttons.push({
				type: "openUrl",
				title: `Open Issue on ${providerNamesById.get(codemark.externalProvider) ||
					codemark.externalProvider}`,
				value: codemark.externalProviderUrl
			});
		}

		buttons.push({
			type: "openUrl",
			title: "Open in IDE",
			value: `${codemark.permalink}?ide=default`
		});
	}

	let fieldsHtml = "";
	if (fields) {
		fieldsHtml = fields
			.map(
				f =>
					`<div style="margin-top:5px;">${
						f.title ? `<p style="font-weight:600;padding: 1rem 0;">${f.title}</p>` : ""
					}${f.value}</div>`
			)
			.join("");
	}

	if (message) {
		if (mentionedUserIds != null && mentionedUserIds.length !== 0) {
			message += ` /cc ${mentionedUserIds
				.map(u => `@${userInfosById.get(u)!.username}`)
				.join(", ")}`;
		}

		message = toTeamsMessageText(
			message,
			mentionedUserIds,
			userInfosById,
			userIdsByName,
			mentionsOut
		);
	}

	if (title) {
		// Ensure we skip mention linking, because they aren't supported in attachments
		title = toTeamsMessageText(
			title,
			mentionedUserIds,
			userInfosById,
			userIdsByName,
			mentionsOut,
			true
		);
	}

	if (text) {
		// Ensure we skip mention linking, because they aren't supported in attachments
		text = toTeamsMessageText(
			text,
			mentionedUserIds,
			userInfosById,
			userIdsByName,
			mentionsOut,
			true
		);
	}

	attachmentsOut.push({
		id: codemark.id,
		contentType: "application/vnd.microsoft.card.thumbnail",
		content: JSON.stringify({
			title: title,
			text: `<div data-codestream="codestream://codemark/${codemark.id}?teamId=${codemark.teamId}" style="margin-top:0.25em;border-left:4px solid ${color};padding-left:0.75em;">
	<p>${text}</p>
	${fieldsHtml}
	<p style="font-size:x-small;font-weight:600;opacity:0.6;">Posted via CodeStream</p>
</div>`,
			buttons: buttons
		})
	});

	return {
		contentType: "html",
		content: `${message}<attachment id="${codemark.id}"></attachment>`
	};
}

export function fromTeamsMessageText(
	message: any,
	userInfosById: Map<string, UserInfo>,
	mentions: TeamsMessageMention[] | undefined,
	mentionedUserIds: string[]
): string {
	if (!message.body) return message.summary || message.subject || "";

	let text = message.body.content;
	// TODO: Get codemark ids from attachments?
	text = text.replace(teamsAttachmentsRegex, "");

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

export function toTeamsMessageText(
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
