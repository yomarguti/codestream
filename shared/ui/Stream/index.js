import React, { Component } from "react";
import { connect } from "react-redux";
import _ from "underscore";
import createClassString from "classnames";
import ChannelPanel from "./ChannelPanel";
import PublicChannelPanel from "./PublicChannelPanel";
import CreateChannelPanel from "./CreateChannelPanel";
import CreateDMPanel from "./CreateDMPanel";
import PostsPanel from "./PostsPanel";
import * as actions from "./actions";
import { goToInvitePage } from "../actions/routing";
import { toMapBy } from "../utils";
import slashCommands from "./slash-commands";
import { confirmPopup } from "./Confirm";
import {
	getPostsForStream,
	getStreamForId,
	getStreamForTeam,
	getStreamForRepoAndFile
} from "../reducers/streams";

export class SimpleStream extends Component {
	constructor(props) {
		super(props);

		this.state = {
			threadId: null,
			activePanel: "channels",
			fileForIntro: props.currentFile
		};
	}

	runSlashCommand = (command, args) => {
		switch (command) {
			case "help":
				return this.postHelp();
			case "add":
				return this.addMembersToStream(args);
			case "who":
				return this.showMembers();
			case "mute":
				return this.toggleMute();
			case "muteall":
				return this.toggleMuteAll();
			case "msg":
				return this.sendDirectMessage(args);
			case "open":
				return this.openStream(args);
			case "prefs":
				return this.openPrefs(args);
			case "rename":
				return this.renameChannel(args);
			case "remove":
				return this.removeFromStream(args);
			case "leave":
				return this.leaveChannel(args);
			case "delete":
				return this.deleteChannel(args);
			case "archive":
				return this.archiveChannel(args);
			case "version":
				return this.postVersion(args);
			case "me":
				return false;
		}
	};

	showChannels = () => {
		this.setState({ activePanel: "channels" });
	};

	ensureStreamIsActive = () => {
		const { activePanel } = this.state;
		if (activePanel === "main") this.focusInput();
		else this.setState({ activePanel: "main" });
	};

	setActivePanel = panel => {
		this.setState({ activePanel: panel });
	};

	notImplementedYet = () => {
		this.submitSystemPost("Not implemented yet");
	};

	markUnread = () => {
		this.submitSystemPost("Not implemented yet");
	};

	focusInput = () => {
		const input = document.getElementById("input-div");
		if (input) input.focus();
	};

	handleClickScrollToNewMessages = () => {
		this.scrollToBottom();
	};

	toggleMute = () => {
		const { postStreamId } = this.props;
		const isMuted = this.props.mutedStreams[postStreamId];
		this.props.setUserPreference(["mutedStreams", postStreamId], !isMuted);
		const text = isMuted ? "This stream has been unmuted." : "This stream has been muted.";
		this.submitSystemPost(text);
		return true;
	};

	showMembers = () => {
		const memberIds = this.props.postStreamMemberIds;
		const streamName = this.props.postStreamName;
		let names = [];
		if (this.props.postStreamIsTeamStream) {
			this.props.teammates.map(user => {
				names.push(user.username);
			});
		} else {
			this.props.teammates.map(user => {
				if (_.contains(memberIds, user.id)) names.push(user.username);
			});
		}
		names = _.sortBy(names, name => name.toLowerCase());

		let text;
		if (names.length === 0) text = "You are the only member in " + streamName;
		else if (names.length === 1)
			text = "Members in " + streamName + " are you and @" + names[0] + ".";
		else {
			text = "Members in " + streamName + " are @" + names.join(", @") + " and you.";
		}

		if (this.props.postStreamIsTeamStream) {
			text +=
				"\n\nThis is an all-hands channel, so every member of your team is automatically added.";
		}

		this.submitSystemPost(text);
		return true;
	};

	extractUsersFromArgs = (args = "") => {
		const { teamMembersById } = this.props;
		let users = [];
		let usernamesArray = [];
		let rest = "";
		args
			.toLowerCase()
			.split(/(\s+)/)
			.map(token => {
				let found = false;
				Object.keys(teamMembersById).map(userId => {
					const username = teamMembersById[userId].username.toLowerCase();
					if (token === username || token === "@" + username) {
						users.push(userId);
						usernamesArray.push("@" + username);
						found = true;
					}
				});
				if (!found) rest += token;
			});
		let usernames = "";
		if (usernamesArray.length === 1) usernames = usernamesArray[0];
		else if (usernamesArray.length > 1) {
			const lastOne = usernamesArray.pop();
			usernames = usernamesArray.join(", ") + " and " + lastOne;
		}
		return { users, usernames, rest };
	};

	addMembersToStream = async args => {
		const { users, usernames, rest } = this.extractUsersFromArgs(args);
		if (this.props.postStreamIsTeamStream) {
			const text =
				"This is an all-hands channel, so every member of your team is automatically added. To invite somone new to the team use the /invite command.";
			return this.submitSystemPost(text);
		}
		if (users.length === 0) {
			this.submitSystemPost("Add members to this channel by typing `/add @nickname`");
		} else {
			await this.props.addUsersToStream(this.props.postStreamId, users);
			this.submitPost({ text: "/me added " + usernames });
		}
		return true;
	};

	renameChannel = async args => {
		if (args) {
			const newStream = await this.props.renameStream(this.props.postStreamId, args);
			if (newStream.name === args) {
				this.submitPost({ text: "/me renamed the channel to " + args });
			} else {
				console.log("NS: ", newStream);
				this.submitSystemPost("Unable to rename channel.");
			}
		} else {
			this.submitSystemPost("Rename a channel by typing `/rename [new name]`");
		}
		return true;
	};

	leaveChannel = () => {
		if (this.props.postStreamIsTeamStream) {
			const text = "You cannot leave all-hands channels.";
			return this.submitSystemPost(text);
		}
		confirmPopup({
			title: "Are you sure?",
			message: "Public channels can be found on the channels list under TEAM CHANNELS.",
			buttons: [
				{
					label: "Leave",
					action: this.executeLeaveChannel
				},
				{ label: "Cancel" }
			]
		});
		return true;
	};

	executeLeaveChannel = () => {
		this.props.removeUsersFromStream(this.props.postStreamId, [this.props.currentUser.id]);
		this.setActivePanel("channels");
		return true;
	};

	deleteChannel = () => {
		this.setActivePanel("channels");
		return true;
	};

	archiveChannel = () => {
		const { postStream, currentUser } = this.props;
		console.log(postStream);
		if (postStream.creatorId !== currentUser.id) {
			let text = "You may only archive channels that you created.";
			if (postStream.creatorId) text += " This channel was created by " + postStream.creatorId;
			this.submitSystemPost(text);
			return true;
		}
		confirmPopup({
			title: "Are you sure?",
			message: "Archived channels can be found on the channels list under TEAM CHANNELS.",
			buttons: [
				{
					label: "Archive",
					action: this.executeArchiveChannel
				},
				{ label: "Cancel" }
			]
		});

		return true;
	};

	executeArchiveChannel = () => {
		const { postStream } = this.props;
		console.log("Calling archive channel with: ", postStream.id);
		this.props.archiveStream(postStream.id, true);
		this.setActivePanel("channels");
	};

	removeFromStream = async args => {
		if (this.props.postStreamIsTeamStream) {
			const text = "You cannot remove people from all-hands channels.";
			return this.submitSystemPost(text);
		}
		const { users, usernames, rest } = this.extractUsersFromArgs(args);
		if (users.length === 0) {
			this.submitSystemPost("Usage: /remove @user");
		} else {
			await this.props.removeUsersFromStream(this.props.postStreamId, users);
			this.submitPost({ text: "/me removed " + usernames });
		}
		return true;
	};

	openStream = _args => {
		// getChannelStreamsForTeam(streams, context.currentTeamId, session.userId) || [],
	};

	sendDirectMessage = async args => {
		const { teamMembersById } = this.props;

		let tokens = args.split(/(\s+)/);
		const id = tokens.shift();

		let user = Object.keys(teamMembersById).find(userId => {
			const username = teamMembersById[userId].username;
			return id === username || id === "@" + username;
		});

		if (!user) return this.submitSystemPost("Usage: /msg @user message");

		// find or create the stream, then select it, then post the message
		const stream = await this.props.createStream({ type: "direct", memberIds: [user] });
		if (stream && stream._id) {
			this.submitPost({ text: tokens.join(" ") });
		}
		return true;
	};

	submitSystemPost = text => {
		const { activePanel } = this.state;
		const { postStreamId, createSystemPost, posts } = this.props;
		const threadId = activePanel === "thread" ? this.state.threadId : null;
		const lastPost = _.last(posts);
		const seqNum = lastPost ? lastPost.seqNum + 0.001 : 0.001;
		createSystemPost(postStreamId, threadId, text, seqNum);
	};

	postHelp = () => {
		const text = "Help message goes here.";
		this.submitSystemPost(text);
		return true;
	};

	postVersion = () => {
		const text = "Version info goes here.";
		this.submitSystemPost(text);
		return true;
	};

	// we render both a main stream (postslist) plus also a postslist related
	// to the currently selected thread (if it exists). the reason for this is
	// to be able to animate between the two streams, since they will both be
	// visible during the transition
	render() {
		const { configs } = this.props;
		const { activePanel } = this.state;

		const streamClass = createClassString({
			stream: true,
			"no-headshots": !configs.showHeadshots,
			"reduced-motion": configs.reduceMotion
		});
		const mainPanelClass = createClassString({
			"off-right":
				activePanel === "channels" ||
				activePanel === "create-channel" ||
				activePanel === "create-dm" ||
				activePanel === "public-channels"
		});

		return (
			<div className={streamClass} ref={ref => (this._div = ref)}>
				<div id="modal-root" />
				<div id="confirm-root" />
				<ChannelPanel
					activePanel={activePanel}
					setActivePanel={this.setActivePanel}
					runSlashCommand={this.runSlashCommand}
				/>
				<PublicChannelPanel activePanel={activePanel} setActivePanel={this.setActivePanel} />
				<CreateChannelPanel activePanel={activePanel} setActivePanel={this.setActivePanel} />
				<CreateDMPanel activePanel={activePanel} setActivePanel={this.setActivePanel} />
				<PostsPanel
					isActive={activePanel === "main"}
					className={mainPanelClass}
					stream={this.props.postStream}
					isMuted={this.props.mutedStreams[this.props.postStreamId]}
					setActivePanel={this.setActivePanel}
					runSlashCommand={this.runSlashCommand}
					posts={this.props.posts}
					currentUser={this.props.currentUser}
					showChannels={this.showChannels}
					showPostsPanel={this.ensureStreamIsActive}
				/>
			</div>
		);
	}
}

const mapStateToProps = ({
	configs,
	session,
	context,
	streams,
	users,
	posts,
	teams,
	onboarding
}) => {
	// TODO: figure out a way to do this elsewhere
	Object.keys(users).forEach(function(key, index) {
		users[key].color = index % 10;
		if (!users[key].username) {
			let email = users[key].email;
			if (email) users[key].username = email.replace(/@.*/, "");
		}
	});

	const fileStream =
		getStreamForRepoAndFile(streams, context.currentRepoId, context.currentFile) || {};

	const teamMembers = teams[context.currentTeamId].memberIds.map(id => users[id]).filter(Boolean);

	// FIXME -- eventually we'll allow the user to switch to other streams, like DMs and channels
	const teamStream = getStreamForTeam(streams, context.currentTeamId) || {};
	const postStream =
		getStreamForId(streams, context.currentTeamId, context.currentStreamId) || teamStream;
	const streamPosts = getPostsForStream(posts, postStream.id);

	const user = users[session.userId];
	const mutedStreams = (user && user.preferences && user.preferences.mutedStreams) || {};

	return {
		configs,
		teamMembersById: toMapBy("id", teamMembers),
		teammates: teamMembers.filter(({ id }) => id !== session.userId),
		postStream,
		postStreamId: postStream.id,
		postStreamName: postStream.name,
		postStreamType: postStream.type,
		postStreamIsTeamStream: postStream.isTeamStream,
		postStreamMemberIds: postStream.memberIds,
		isPrivate: postStream.privacy === "private",
		fileStreamId: fileStream.id,
		teamId: context.currentTeamId,
		repoId: context.currentRepoId,
		hasFocus: context.hasFocus,
		firstTimeInAtom: onboarding.firstTimeInAtom,
		currentFile: context.currentFile,
		currentCommit: context.currentCommit,
		editingUsers: fileStream.editingUsers,
		currentUser: user,
		mutedStreams,
		slashCommands,
		team: teams[context.currentTeamId],
		posts: streamPosts.map(post => {
			let user = users[post.creatorId];
			if (!user) {
				if (post.creatorId === "codestream") {
					user = {
						username: "CodeStream",
						email: "",
						firstName: "",
						lastName: ""
					};
				} else {
					console.warn(
						`Redux store doesn't have a user with id ${post.creatorId} for post with id ${post.id}`
					);
					user = {
						username: "Unknown user",
						email: "",
						firstName: "",
						lastName: ""
					};
				}
			}
			const { username, email, firstName = "", lastName = "", color } = user;
			return {
				...post,
				author: {
					username,
					email,
					color,
					fullName: `${firstName} ${lastName}`.trim()
				}
			};
		})
	};
};

export default connect(mapStateToProps, {
	...actions,
	goToInvitePage
})(SimpleStream);
