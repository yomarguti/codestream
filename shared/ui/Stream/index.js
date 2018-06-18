import React, { Component } from "react";
import { connect } from "react-redux";
import _ from "underscore";
import createClassString from "classnames";
import ChannelPanel from "./ChannelPanel";
import PublicChannelPanel from "./PublicChannelPanel";
import CreateChannelPanel from "./CreateChannelPanel";
import CreateDMPanel from "./CreateDMPanel";
import PostsPanel from "./PostsPanel";
import EventEmitter from "../event-emitter";
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
	disposables = [];

	constructor(props) {
		super(props);

		this.state = {
			threadId: null,
			activePanel: "channels",
			fileForIntro: props.currentFile
		};
		this._compose = React.createRef();
	}

	componentDidMount() {
		if (this._postslist) {
			this._postslist.addEventListener("scroll", this.handleScroll.bind(this));
			// this resize observer fires when the height of the
			// postslist changes, when the window resizes in width
			// or height, but notably not when new posts are added
			// this is because the height of the HTML element is
			// set explicitly
			new ResizeObserver(() => {
				this.handleScroll();
			}).observe(this._postslist);
		}
	}

	UNSAFE__componentWillReceiveProps(nextProps) {
		const switchingFileStreams = nextProps.fileStreamId !== this.props.fileStreamId;
		const switchingPostStreams = nextProps.postStreamId !== this.props.postStreamId;

		if (nextProps.fileStreamId && switchingFileStreams && nextProps.posts.length === 0) {
			// FIXME: is this still necessary? this was because there was no lazy loading and file streams were complex
			// this.props.fetchPosts({ streamId: nextProps.fileStreamId, teamId: nextProps.teamId });
		}

		if (switchingPostStreams) {
			this.handleDismissThread({ track: false });

			// keep track of the new message indicator in "this" instead of looking
			// directly at currentUser.lastReads, because that will change and trigger
			// a re-render, which would remove the "new messages" line
			// console.log("Switch to: ", nextProps.postStreamId);
		}
		// this.postWithNewMessageIndicator = 10;

		// TODO: DELETE
		if (nextProps.firstTimeInAtom && !this.state.fileForIntro) {
			this.setState({ fileForIntro: nextProps.currentFile });
		}

		if (nextProps.hasFocus && !this.props.hasFocus) {
			this.postWithNewMessageIndicator = null;
		}
		if (!nextProps.hasFocus && this.props.hasFocus) {
			this.postWithNewMessageIndicator = null;
			if (this.props.currentUser && this.props.currentUser.lastReads) {
				this.postWithNewMessageIndicator = this.props.currentUser.lastReads[nextProps.postStreamId];
			}
		}
		if (this.props.currentUser && this.props.currentUser.lastReads) {
			this.postWithNewMessageIndicator = this.props.currentUser.lastReads[nextProps.postStreamId];
		}
	}

	componentWillUnmount() {
		this.disposables.forEach(d => d.dispose());
	}

	copy(event) {
		let selectedText = window.getSelection().toString();
		atom.clipboard.write(selectedText);
		event.abortKeyBinding();
	}

	checkMarkStreamRead() {
		// if we have focus, and there are no unread indicators which would mean an
		// unread is out of view, we assume the entire thread has been observed
		// and we mark the stream read
		if (this.props.hasFocus && !this.state.unreadsAbove && !this.state.unreadsBelow) {
			try {
				if (this.props.currentUser.lastReads[this.props.postStreamId]) {
					this.props.markStreamRead(this.props.postStreamId);
				}
			} catch (e) {
				/* lastReads is probably undefined */
			}
		}
	}

	componentDidUpdate(prevProps, prevState) {
		const { postStreamId, markStreamRead } = this.props;

		// this.scrollToBottom();

		// if we just switched to a new stream, (eagerly) mark both old and new as read
		if (postStreamId !== prevProps.postStreamId) {
			markStreamRead(postStreamId);

			markStreamRead(prevProps.postStreamId);
			// this.resizeStream();
		}

		// if we are switching from a non-thread panel
		if (this.state.activePanel === "main" && prevState.activePanel !== "main") {
			setTimeout(() => {
				this.focusInput();
			}, 500);
		}

		// if we just got the focus, mark the new stream read
		if (this.props.hasFocus && !prevProps.hasFocus) {
			this.checkMarkStreamRead();
		}

		if (
			!this.state.unreadsAbove &&
			!this.state.unreadsBelow &&
			(prevState.unreadsAbove || prevState.unreadsBelow)
		) {
			console.log("CDU: cmsr");
			this.checkMarkStreamRead();
		}

		if (prevState.threadId !== this.state.threadId) {
			// this.resizeStream();
		}

		if (prevProps.hasFocus !== this.props.hasFocus) this.handleScroll();

		if (this.props.posts.length !== prevProps.posts.length) {
			const lastPost = this.props.posts[this.props.posts.length - 1];

			if (lastPost) {
				// if the latest post is mine, scroll to the bottom always
				// otherwise, if we've scrolled up, then just call
				// handleScroll to make sure new message indicators
				// appear as appropriate.
				const mine = this.props.currentUser.username === lastPost.author.username;
				if (mine || !this.state.scrolledOffBottom) this.scrollToBottom();
				else this.handleScroll();
			} else {
				console.log("Could not find lastPost for ", this.props.posts);
			}
		}

		if (this.state.editingPostId !== prevState.editingPostId) {
			// special-case the editing of the bottom-most post...
			// scroll it into view. in all other cases we let the
			// focus of the input field make sure the post is focused
			const lastPost = this.props.posts[this.props.posts.length - 1];
			if (lastPost && this.state.editingPostId == lastPost.id) this.scrollToBottom(true);
		}

		// if we're switching from the channel list to a stream,
		// then check to see if we should scroll to the bottom
		if (this.state.activePanel === "main" && prevState.activePanel !== "main") {
			if (!this.state.scrolledOffBottom) this.scrollToBottom();
		}
	}

	handleResizeCompose = () => {
		// this.resizeStream();
	};

	resizeStream = () => {
		if (!this._div || !this._compose) return;
		const streamHeight = this._div.offsetHeight;
		const postslistHeight = this._postslist.offsetHeight;
		const composeHeight = this._compose.current.offsetHeight;
		const headerHeight = this._header.offsetHeight;
		if (postslistHeight < streamHeight) {
			let newHeight = streamHeight - postslistHeight + this._intro.offsetHeight - composeHeight;
			this._intro.style.height = newHeight + "px";
		}
		const padding = composeHeight + headerHeight;
		// this._div.style.paddingBottom = padding + "px";
		this._mainPanel.style.paddingBottom = padding + "px";
		// we re-measure the height of postslist here because we just changed
		// it with the style declaration immediately above
		this._threadpostslist.style.height = this._postslist.offsetHeight + "px";
		// this._threadpostslist.style.top = headerHeight + "px";
		// if (this._atMentionsPopup)
		// this._atMentionsPopup.style.bottom = this._compose.offsetHeight + "px";

		let scrollHeight = this._postslist.scrollHeight;
		let currentScroll = this._postslist.scrollTop;
		let offBottom = scrollHeight - currentScroll - streamHeight + composeHeight + headerHeight;
		// if i am manually scrolling, don't programatically scroll to bottom
		// offBottom is how far we've scrolled off the bottom of the posts list
		console.log("OFF BOTTOM IS: ", offBottom);
		if (offBottom < 100) this.scrollToBottom();
	};

	scrollToBottom = () => {};

	calculateScrolledOffBottom = () => {};

	// return the post, if any, with the given ID
	findPostById(id) {
		return this.props.posts.find(post => id === post.id);
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

	findMyPostBeforeSeqNum(seqNum) {
		const me = this.props.currentUser.username;
		return _.chain(this.props.posts)
			.filter(post => {
				return post.author.username === me && post.seqNum < seqNum;
			})
			.last()
			.value();
	}

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

	handleScroll(_event) {
		const scrollDiv = this._postslist;

		if (!scrollDiv) {
			// console.log("Couldn't find scrollDiv for ", event);
			return;
		}

		const scrollTop = scrollDiv.scrollTop;
		const containerHeight = scrollDiv.parentNode.offsetHeight;
		const scrollHeight = scrollDiv.scrollHeight;
		const offBottom = scrollHeight - scrollTop - scrollDiv.offsetHeight;
		const scrolledOffBottom = offBottom > 100;
		// console.log("OB IS: ", offBottom);
		if (scrolledOffBottom !== this.state.scrolledOffBottom)
			this.setState({ scrolledOffBottom: scrolledOffBottom });

		let unreadsAbove = false;
		let unreadsBelow = false;

		let umiDivs = scrollDiv.getElementsByClassName("unread");
		Array.from(umiDivs).forEach(umi => {
			let top = umi.offsetTop;
			if (top - scrollTop + 10 < 0) {
				if (!unreadsAbove) unreadsAbove = umi;
			} else if (top - scrollTop + 60 + umi.offsetHeight > containerHeight) {
				unreadsBelow = umi;
			} else if (this.props.hasFocus) {
				umi.classList.remove("unread");
			}
		});
		if (this.state.unreadsAbove != unreadsAbove) this.setState({ unreadsAbove: unreadsAbove });
		if (this.state.unreadsBelow != unreadsBelow) this.setState({ unreadsBelow: unreadsBelow });
	}

	// dismiss the thread stream and return to the main stream
	handleDismissThread = ({ track = true } = {}) => {
		EventEmitter.emit("interaction:thread-closed", this.findPostById(this.state.threadId));
		this.setState({ activePanel: "main" });
		this.focusInput();
		if (track)
			EventEmitter.emit("analytics", {
				label: "Page Viewed",
				payload: { "Page Name": "Source Stream" }
			});
	};

	handleEditPost = event => {
		var postDiv = event.target.closest(".post");
		if (!postDiv) return;
		this.setState({ editingPostId: postDiv.id });
	};

	handleDeletePost = event => {
		var postDiv = event.target.closest(".post");
		if (!postDiv || !postDiv.id) return;
		this.confirmDeletePost(postDiv.id);
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

	handleDismissEdit() {
		this.setState({ editingPostId: null });
		this.focusInput();
	}

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
			// this._compose.current.insertIfEmpty("/rename");
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
