export function getSlashCommands(capabilities) {
	return slashCommands.filter(
		command => capabilities[command.id] === undefined || capabilities[command.id] === true
	);
}

export const slashCommands = [
	{ id: "help", help: "get help" },
	{
		id: "add",
		help: "add member to channel",
		description: "@user",
		channelOnly: true
	},
	// { id: "apply", help: "apply patch last post" },
	{ id: "archive", help: "archive channel", channelOnly: true },
	// { id: "diff", help: "diff last post" },

	// these two are going to call the same function but have different descriptions
	// depending on whether you're a slack team or not
	{ id: "invite", help: "add to your team", description: "email", codeStreamTeam: true },
	{ id: "invite", help: "invite teammates to CodeStream", slackTeam: true },

	{ id: "leave", help: "leave channel", channelOnly: true },
	{ id: "liveshare", help: "start live share", requires: "vsls" },
	{ id: "me", help: "emote", description: "text" },
	{ id: "msg", help: "message member", description: "@user text" },
	{ id: "mute", help: "mute channel", channelOnly: true, codeStreamTeam: true },
	// { id: "muteall", help: "mute codestream" },
	// { id: "open", help: "open channel" },
	// { id: "prefs", help: "open preferences" },
	{
		id: "purpose",
		help: "set purpose",
		description: "text",
		channelOnly: true
	},
	{
		id: "remove",
		help: "remove from channel",
		description: "@user",
		channelOnly: true
	},
	{
		id: "rename",
		help: "rename channel",
		description: "newname",
		channelOnly: true
	},
	// { id: "slack", help: "connect to slack", codeStreamTeam: true },
	{ id: "version", help: "show codeStream version" },
	{ id: "who", help: "show channel members" }
];
