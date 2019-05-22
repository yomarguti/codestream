"use strict";
import { Marker } from "../../api/extensions";
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

const defaultCreatedAt = 181886400000;
const defaultCreator = "0";

export async function fromTeamsPost(
	post: any,
	streamId: string,
	usernamesById: Map<string, string>,
	teamId: string
): Promise<CSPost> {
	const mentionedUserIds: string[] = [];

	const text = fromTeamsPostText(post, usernamesById, mentionedUserIds);

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

	const timestamp = new Date(post.createdDateTime).getTime() / 1000;
	const modifiedTimestamp =
		new Date(post.lastModifiedDateTime || post.createdDateTime).getTime() / 1000;
	return {
		codemarkId: undefined, // codemark && codemark.id,
		createdAt: timestamp,
		creatorId: post.from.user && post.from.user.id,
		deactivated: post.deleted,
		// files: files,
		hasBeenEdited: timestamp !== modifiedTimestamp,
		numReplies: 0,
		id: toTeamsPostId(post.id, streamId),
		mentionedUserIds: mentionedUserIds,
		modifiedAt: modifiedTimestamp,
		parentPostId: post.replyToId ? toTeamsPostId(post.replyToId, streamId) : undefined,
		// reactions: reactions,
		text: text,
		seqNum: post.id,
		streamId: streamId,
		teamId: teamId
	};
}

export function toTeamsPostBody(
	codemark: CSCodemark,
	remotes: string[] | undefined,
	markers: CSMarker[] | undefined,
	markerLocations: CSMarkerLocations[] | undefined,
	usernamesById: Map<string, string>,
	teamsUserId: string
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
				color = "#888888";
				break;
			default:
				color = undefined!;
				break;
		}
	}

	let author;
	// let authorIcon;
	let fields:
		| {
				title: string;
				value: string;
				short?: boolean;
		  }[]
		| undefined;
	let text;
	let title;
	let fallback;

	switch (codemark.type) {
		case CodemarkType.Comment:
			author = `${usernamesById.get(teamsUserId)} commented on code`;
			fallback = `\n${author}`;

			text = codemark.text;
			if (text) {
				fallback = `\n${text}`;
			}
			break;
		case CodemarkType.Bookmark:
			author = `${usernamesById.get(teamsUserId)} set a bookmark`;
			fallback = `\n${author}`;

			text = codemark.text;
			if (text) {
				fallback = `\n${text}`;
			}
			break;
		case CodemarkType.Issue:
			author = `${usernamesById.get(teamsUserId)} posted an issue`;
			fallback = `\n${author}`;

			title = codemark.title;
			if (title) {
				fallback = `\n${title}`;
			}

			text = codemark.text;
			if (text) {
				fallback += `\n${text}`;
			}

			if (codemark.assignees !== undefined && codemark.assignees.length !== 0) {
				if (fields === undefined) {
					fields = [];
				}

				fields.push({
					title: "Assignees",
					value: codemark.assignees.map(a => usernamesById.get(a)).join(", ")
				});
			}

			break;
		case CodemarkType.Question:
			author = `${usernamesById.get(teamsUserId)} has a question`;
			fallback = `\n${author}`;

			title = codemark.title;
			if (title) {
				fallback = `\n${title}`;
			}
			text = codemark.text;
			if (text) {
				fallback += `\n${text}`;
			}
			break;
		case CodemarkType.Trap:
			author = `${usernamesById.get(teamsUserId)} created a trap`;
			fallback = `\n${author}`;

			text = codemark.text;
			if (text) {
				fallback = `\n${text}`;
			}
			break;
	}

	if (markers !== undefined && markers.length !== 0) {
		if (fields === undefined) {
			fields = [];
		}

		for (const marker of markers) {
			let title;
			let start;
			let end;

			if (markerLocations) {
				const location = markerLocations[0].locations[marker.id];
				[start, , end] = location!;
				title = `<b>${marker.file} (Line${start === end ? ` ${start}` : `s ${start}-${end}`})</b>`;
			} else {
				title = `<b>${marker.file}</b>`;
			}

			// const code = `\n\`\`\`${marker.code}\`\`\``;
			const code = `<br/ ><code>${marker.code}</code>`;

			fallback += `${fallback ? "\n" : ""}\n${title}${code}`;

			if (
				remotes !== undefined &&
				remotes.length !== 0 &&
				start !== undefined &&
				end !== undefined
			) {
				let url;
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

				if (url !== undefined) {
					title = `<a href="${url.url}">${title}</a>`;
				}
			}

			fields.push({
				title: undefined!, // This is because slack has the wrong type def here
				value: `${title}${code}`
			});
		}
	}

	let fieldsHtml = "";
	if (fields) {
		fieldsHtml = fields
			.map(f => `<div>${f.title ? `<h4>${f.title}</h4>` : ""}${f.value}</div>`)
			.join("");
	}

	return {
		contentType: "html",
		content: `<h2>${author}</h2><p>${text}</p>${fieldsHtml}<footer>Posted via CodeStream</footer>`
	};

	// const attachment: MessageAttachment = {
	// 	fallback: fallback !== undefined ? fallback.substr(1) : undefined,
	// 	author_name: author,
	// 	title: title,
	// 	fields: fields,
	// 	text: text,
	// 	footer: "Posted via CodeStream",
	// 	ts: (new Date().getTime() / 1000) as any,
	// 	color: color,
	// 	callback_id: `codestream://codemark/${codemark.id}?teamId=${codemark.teamId}`,
	// 	mrkdwn_in: ["fields", "pretext", "text"]
	// };
	// return attachment;
}

export function fromTeamsPostId<T extends string | undefined>(
	postId: T,
	streamId: string
): { streamId: string; postId: T } {
	if (postId == null) {
		return { streamId: streamId, postId: postId };
	}

	const index = postId.lastIndexOf("|");
	if (index === -1) return { streamId: streamId, postId: postId };

	return { streamId: postId.substring(0, index), postId: postId.substr(index + 1) as T };
}

export function toTeamsPostId(postId: string, streamId: string) {
	return `${streamId}|${postId}`;
}

export function fromTeamsPostText(
	post: any,
	usernamesById: Map<string, string>,
	mentionedUserIds: string[]
): string {
	if (!post.body) return post.summary || post.subject || "";

	const text = post.body.content;
	return text;
}

export function fromTeamsChannel(
	channel: any,
	teamsUserId: string,
	codestreamTeamId: string
): CSChannelStream {
	let memberIds: string[] | undefined;
	if (channel.displayName !== "General") {
		// TODO: If we are missing membership, what should we do?
		// Add an isMember propery to the stream and keep members undefined ?
		memberIds = channel.members == null ? [teamsUserId] : channel.members;
	}

	return {
		createdAt: defaultCreatedAt,
		creatorId: defaultCreator,
		id: channel.id,
		isArchived: false,
		isTeamStream: channel.displayName === "General",
		name: channel.displayName || "",
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

export function toTeamsTeam(team: CSTeam, usernamesById: Map<string, string>) {
	team.memberIds = [...usernamesById.keys()];
	// team.memberIds = team.memberIds.map(m => {
	// 	const u = usernamesById.get(m);
	// 	return u !== undefined ? u.id : m;
	// });
}

export function fromTeamsUser(user: any, teamId: string, csTeamMembers: CSUser[] = []): CSUser {
	let codestreamId: string | undefined;
	csTeamMembers.some(m => {
		if (m.providerIdentities) {
			if (m.providerIdentities.includes(`teams::${user.id}`)) {
				codestreamId = m.id;
				return true;
			}
		}
		return false;
	});

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
		// TODO: Look this up in the CodeStream user list
		isRegistered: true,
		iWorkOn: undefined,
		lastPostCreatedAt: defaultCreatedAt,
		lastName: user.surname,
		modifiedAt: defaultCreatedAt,
		numInvites: 0,
		numMentions: 0,
		registeredAt: defaultCreatedAt,
		// TODO: Need to hold both codestream and slack teams?
		teamIds: [teamId],
		timeZone: "",
		// TODO: ???
		totalPosts: 0,
		username: user.displayName
	};
}

function nullToUndefined<T>(value: T | null | undefined): T | undefined {
	return value == null ? undefined : value;
}
