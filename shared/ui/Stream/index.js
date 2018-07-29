import React, { Component } from "react";
import { connect } from "react-redux";
import _ from "underscore";
import createClassString from "classnames";
import ComposeBox from "./ComposeBox";
import DateSeparator from "./DateSeparator";
import ChannelPanel from "./ChannelPanel";
import InvitePanel from "./InvitePanel";
import PublicChannelPanel from "./PublicChannelPanel";
import CreateChannelPanel from "./CreateChannelPanel";
import CreateDMPanel from "./CreateDMPanel";
import EditingIndicator from "./EditingIndicator";
import ChannelMenu from "./ChannelMenu";
import Post from "./Post";
import Icon from "./Icon";
import EventEmitter from "../event-emitter";
import * as actions from "./actions";
import { toMapBy } from "../utils";
import { slashCommands } from "./SlashCommands";
import { confirmPopup } from "./Confirm";
import {
	getPostsForStream,
	getStreamForId,
	getStreamForTeam,
	getStreamForRepoAndFile
} from "../reducers/streams";
import { createPost, createSystemPost, editPost, deletePost } from "./actions";

const EMAIL_MATCH_REGEX = new RegExp(
	"[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*",
	"g"
);

export class SimpleStream extends Component {
	disposables = [];

	constructor(props) {
		super(props);

		this.state = {
			initialRender: true,
			threadId: null,
			activePanel: "channels",
			fileForIntro: props.currentFile
		};
		this._compose = React.createRef();
	}

	static getDerivedStateFromProps(props, state) {
		return state.initialRender && props.postStreamId && props.startOnMainPanel
			? { activePanel: "main", initialRender: false }
			: { initialRender: false };
	}

	componentDidMount() {
		this.disposables.push(
			EventEmitter.subscribe("interaction:marker-selected", this.handleMarkerSelected)
		);

		// this listener pays attention to when the input field resizes,
		// presumably because the user has typed more than one line of text
		// in it, and calls a function to handle the new size
		new ResizeObserver(this.handleResizeCompose).observe(this._compose.current);

		// go ahead and do resizing because some environments (VS Code) have a
		// polyfill for ResizeObserver which won't be triggered automatically
		this.handleResizeCompose();

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

		this.scrollToBottom();

		if (
			this.state.activePanel === "main" &&
			this.props.postStreamId &&
			this.props.posts.length === 0
		) {
			this.props.fetchPosts({ streamId: this.props.postStreamId, teamId: this.props.teamId });
		}

		if (global.atom) {
			this.disposables.push(
				atom.keymaps.add("codestream", {
					"atom-workspace": {
						escape: "codestream:escape",
						"cmd-c": "codestream:copy"
					}
				}),
				atom.commands.add("atom-workspace", "codestream:escape", {
					didDispatch: event => this.handleEscape(event),
					hiddenInCommandPalette: true
				}),
				atom.commands.add("atom-workspace", "codestream:copy", {
					didDispatch: event => this.copy(event),
					hiddenInCommandPalette: true
				})
			);
		}

		const rootInVscode = document.querySelector("body.codestream");
		if (rootInVscode) {
			rootInVscode.onkeydown = event => {
				if (event.key === "Escape") {
					if (this.state.threadId) {
						this.handleDismissThread();
					}
				}
				if (event.key === "ArrowUp" && event.target.id !== "input-div") {
					this.editLastPost(event);
				}
			};
		}
	}

	componentWillReceiveProps(nextProps) {
		const switchingFileStreams = nextProps.fileStreamId !== this.props.fileStreamId;
		const switchingPostStreams = nextProps.postStreamId !== this.props.postStreamId;

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

		// if (nextProps.hasFocus && !this.props.hasFocus) {
		// 	this.postWithNewMessageIndicator = null;
		// }
		// if (!nextProps.hasFocus && this.props.hasFocus) {
		// 	this.postWithNewMessageIndicator = null;
		// 	if (this.props.currentUser && this.props.currentUser.lastReads) {
		// 		this.postWithNewMessageIndicator = this.props.currentUser.lastReads[nextProps.postStreamId];
		// 	}
		// }

		if (switchingPostStreams) {
			console.log("SETTING PWNMI to NULL!");
			this.postWithNewMessageIndicator = undefined;
		}
		if (
			nextProps.currentUser &&
			nextProps.currentUser.lastReads &&
			typeof nextProps.currentUser.lastReads[nextProps.postStreamId] !== "undefined"
		) {
			console.log("SETTING PWNMI to ", nextProps.currentUser.lastReads[nextProps.postStreamId]);
			this.postWithNewMessageIndicator = nextProps.currentUser.lastReads[nextProps.postStreamId];
		}
	}

	componentWillUnmount() {
		this.disposables.forEach(d => d.dispose());
	}

	handleMarkerSelected = ({ postId }) => {
		this.selectPost(postId);
	};

	copy(event) {
		let selectedText = window.getSelection().toString();
		atom.clipboard.write(selectedText);
		event.abortKeyBinding();
	}

	checkMarkStreamRead() {
		// if we have focus, and there are no unread indicators which would mean an
		// unread is out of view, we assume the entire thread has been observed
		// and we mark the stream read
		// console.log("checkMarkStreamRead");

		if (
			this.props.hasFocus &&
			this.state.activePanel === "main" &&
			!this.state.unreadsAbove &&
			!this.state.unreadsBelow
		) {
			try {
				// this gets called pretty often, so only ping the API
				// server if there is an actual change
				if (typeof this.props.currentUser.lastReads[this.props.postStreamId] !== "undefined") {
					console.log("Marking within check");
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

		// if we just switched to a new stream, check to see if we are up-to-date
		if (postStreamId !== prevProps.postStreamId) {
			this.checkMarkStreamRead();
			this.resizeStream();
			if (postStreamId) this.setActivePanel("main");
		}

		// if we just got the focus, check to see if we are up-to-date
		if (this.props.hasFocus && !prevProps.hasFocus) {
			this.checkMarkStreamRead();
		}

		// if we are switching from a non-thread panel
		if (this.state.activePanel === "main" && prevState.activePanel !== "main") {
			setTimeout(() => {
				this.focusInput();
			}, 500);
		}

		// if we are scrolling around (which changes unreadsAbove and/or unreadsBelow)
		// then check to see if we are up-to-date
		if (
			!this.state.unreadsAbove &&
			!this.state.unreadsBelow &&
			(prevState.unreadsAbove || prevState.unreadsBelow)
		) {
			console.log("CDU: cmsr");
			this.checkMarkStreamRead();
		}

		// when going in and out of threads, make sure the streams are all
		// the right height
		if (prevState.threadId !== this.state.threadId) {
			this.resizeStream();
		}

		if (prevProps.hasFocus !== this.props.hasFocus) this.handleScroll();

		// FIXME -- there should be a more definitive way
		// to detect when a new post came in
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
			if (postStreamId && this.props.posts.length === 0) {
				this.props.fetchPosts({ streamId: postStreamId, teamId: this.props.teamId });
			}
			// FIXME only scroll to the first unread message
			if (!this.state.scrolledOffBottom) this.scrollToBottom();
		}
	}

	handleResizeCompose = () => {
		this.resizeStream();
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
		// console.log("OFF BOTTOM IS: ", offBottom);
		if (offBottom < 100) this.scrollToBottom();
	};

	scrollToBottom = force => {
		// don't scroll to bottom if we're in the middle of an edit,
		// unless the force parameter is called
		if (this.state.editingPostId && !force) return;
		if (this._postslist) this._postslist.scrollTop = 1000000;
	};

	calculateScrolledOffBottom = () => {};

	// return the post, if any, with the given ID
	findPostById(id) {
		return this.props.posts.find(post => id === post.id);
	}

	handleClickHelpLink = event => {
		event.preventDefault();
		EventEmitter.emit("interaction:clicked-link", "https://help.codestream.com");
	};

	renderIntro = nameElement => {
		const [first, ...rest] = this.props.channelMembers
			.filter(member => member.id !== this.props.currentUser.id)
			.map(member => member.username)
			.sort();

		const localizedMembers =
			rest.length === 1
				? `${first} and ${rest[0]}`
				: rest.reduce(
						(result, string, index, array) =>
							index === array.length - 1 ? `${result}, and ${string}` : `${result}, ${string}`,
						first
				  );

		return (
			<label key="info">
				{this.props.postStream.type === "direct" ? (
					<span>This is the beginning of your direct message with {localizedMembers}.</span>
				) : (
					<span>
						This is the beginning of the <b>{nameElement}</b> channel.
					</span>
				)}
			</label>
		);
	};

	renderThreadPosts = threadId => {
		let lastTimestamp = 0;
		return this.props.posts.map(post => {
			if (post.deactivated) return null;
			if (!threadId || threadId !== post.parentPostId) {
				return null;
			}
			// this needs to be done by storing the return value of the render,
			// then setting lastTimestamp, otherwise you wouldn't be able to
			// compare the current one to the prior one.
			const returnValue = (
				<div key={post.id}>
					<DateSeparator timestamp1={lastTimestamp} timestamp2={post.createdAt} />
					<Post
						post={post}
						usernames={this.props.usernamesRegexp}
						currentUsername={this.props.currentUser.username}
						showDetails="1"
						currentCommit={this.props.currentCommit}
						editing={post.id === this.state.editingPostId}
						action={this.postAction}
					/>
				</div>
			);
			lastTimestamp = post.createdAt;
			return returnValue;
		});
	};

	// we render both a main stream (postslist) plus also a postslist related
	// to the currently selected thread (if it exists). the reason for this is
	// to be able to animate between the two streams, since they will both be
	// visible during the transition
	render() {
		const { configs, posts, umis } = this.props;
		const { activePanel } = this.state;

		const streamClass = createClassString({
			stream: true,
			"no-headshots": !configs.showHeadshots,
			"reduced-motion": configs.reduceMotion
		});
		const postsListClass = createClassString({
			postslist: true
		});
		const threadPostsListClass = createClassString({
			postslist: true,
			threadlist: true
		});
		const mainPanelClass = createClassString({
			panel: true,
			"main-panel": true,
			shrink: activePanel === "thread",
			"off-right":
				activePanel === "channels" ||
				activePanel === "create-channel" ||
				activePanel === "create-dm" ||
				activePanel === "public-channels" ||
				activePanel === "invite"
		});
		const threadPanelClass = createClassString({
			panel: true,
			"thread-panel": true,
			"off-right": activePanel !== "thread"
		});

		let lastTimestamp = null;
		let threadId = this.state.threadId;
		let threadPost = this.findPostById(threadId);

		let placeholderText = "Message #" + this.props.postStreamName;
		if (this.props.postStreamType === "direct") {
			placeholderText = "Message " + this.props.postStreamName;
		}
		if (activePanel === "thread" && threadPost) {
			placeholderText = "Reply to " + threadPost.author.username;
		}

		const streamDivId = "stream-" + this.props.postStreamId;
		let unread = false;

		const unreadsAboveClass = createClassString({
			unreads: true,
			active: this.state.unreadsAbove
		});
		const unreadsBelowClass = createClassString({
			unreads: true,
			offscreen: activePanel !== "main",
			active: this.state.unreadsBelow
		});
		const unreadsAbove =
			activePanel === "thread" ? null : (
				<div className={unreadsAboveClass} type="above" onClick={this.handleClickUnreads}>
					&uarr; Unread Messages &uarr;
				</div>
			);

		const umisClass = createClassString("align-left-button", {
			umis: true,
			"align-left-button": true,
			mentions: umis.totalMentions > 0,
			unread: umis.totalMentions == 0 && umis.totalUnread > 0
		});

		const channelIcon =
			this.props.postStreamType === "direct" ? (
				<Icon name="organization" />
			) : this.props.isPrivate ? (
				<Icon name="lock" />
			) : (
				<span>#</span>
			);
		const menuActive = this.state.openMenu === this.props.postStreamId;
		// const totalUMICount = umis.totalMentions || umis.totalUnread || "";
		// const totalUMICount = umis.totalMentions || umis.totalUnread ? "&middot;" : "\u25C9";
		const totalUMICount = umis.totalMentions ? (
			<label>{umis.totalMentions}</label>
		) : umis.totalUnread ? (
			<Icon name="chevron-left" className="show-channels-icon" />
		) : (
			""
		);

		return (
			<div
				className={streamClass}
				onMouseDown={this.handleMouseDown}
				ref={ref => (this._div = ref)}
			>
				<div id="modal-root" />
				<div id="confirm-root" />
				<EditingIndicator
					editingUsers={this.props.editingUsers}
					inactive={activePanel === "xmain"} // or if no fileStream
					currentUser={this.props.currentUser}
					teamMembers={this.props.teamMembersById}
				/>
				<ChannelPanel
					activePanel={activePanel}
					setActivePanel={this.setActivePanel}
					runSlashCommand={this.runSlashCommand}
				/>
				<PublicChannelPanel activePanel={activePanel} setActivePanel={this.setActivePanel} />
				<CreateChannelPanel activePanel={activePanel} setActivePanel={this.setActivePanel} />
				<CreateDMPanel activePanel={activePanel} setActivePanel={this.setActivePanel} />
				<InvitePanel activePanel={activePanel} setActivePanel={this.setActivePanel} />
				<div className={mainPanelClass} ref={ref => (this._mainPanel = ref)}>
					<div className="panel-header" ref={ref => (this._header = ref)}>
						<span onClick={this.showChannels} className={umisClass}>
							<Icon name="chevron-left" className="show-channels-icon" />
							{totalUMICount}
						</span>
						<span>
							{channelIcon} {this.props.postStreamName}
						</span>
						{this.props.postStreamType !== "direct" && (
							<span className="align-right-button" onClick={this.handleClickStreamSettings}>
								<Icon name="gear" className="show-settings" />
								{menuActive && (
									<ChannelMenu
										stream={this.props.postStream}
										target={this.state.menuTarget}
										umiCount={0}
										isMuted={this.props.mutedStreams[this.props.postStreamId]}
										setActivePanel={this.setActivePanel}
										runSlashCommand={this.runSlashCommand}
										closeMenu={this.closeMenu}
									/>
								)}
							</span>
						)}
					</div>
					{unreadsAbove}
					<div
						className={postsListClass}
						ref={ref => (this._postslist = ref)}
						onClick={this.handleClickPost}
						id={streamDivId}
					>
						<div className="intro" ref={ref => (this._intro = ref)}>
							{this.renderIntro(
								<span>
									{channelIcon}
									{this.props.postStreamName}
								</span>
							)}
						</div>
						{posts.map(post => {
							if (post.deactivated) return null;
							// this needs to be done by storing the return value of the render,
							// then setting lastTimestamp, otherwise you wouldn't be able to
							// compare the current one to the prior one.
							const parentPost = post.parentPostId
								? posts.find(p => p.id === post.parentPostId)
								: null;
							const newMessageIndicator =
								typeof this.postWithNewMessageIndicator !== "undefined" &&
								post.seqNum === this.postWithNewMessageIndicator + 1;
							unread = unread || newMessageIndicator;
							const returnValue = (
								<div key={post.id}>
									<DateSeparator timestamp1={lastTimestamp} timestamp2={post.createdAt} />
									<Post
										post={post}
										usernames={this.props.usernamesRegexp}
										currentUsername={this.props.currentUser.username}
										replyingTo={parentPost}
										newMessageIndicator={newMessageIndicator}
										unread={unread}
										editing={activePanel === "main" && post.id === this.state.editingPostId}
										action={this.postAction}
									/>
								</div>
							);
							lastTimestamp = post.createdAt;
							return returnValue;
						})}
					</div>
				</div>
				<div className={threadPanelClass}>
					<div id="close-thread" className="panel-header" onClick={this.handleDismissThread}>
						<span>
							<span className="align-left-button">
								<Icon
									name="chevron-left"
									onClick={this.showChannels}
									className="show-channels-icon"
								/>
								<label>
									Back <span className="keybinding">(esc)</span>
								</label>
							</span>
						</span>
					</div>
					<div
						className={threadPostsListClass}
						ref={ref => (this._threadpostslist = ref)}
						onClick={this.handleClickPost}
					>
						{threadPost && (
							<Post
								post={threadPost}
								usernames={this.props.usernamesRegexp}
								currentUsername={this.props.currentUser.username}
								key={threadPost.id}
								showDetails="1"
								currentCommit={this.props.currentCommit}
								editing={activePanel === "thread" && threadPost.id === this.state.editingPostId}
								action={this.postAction}
							/>
						)}
						{this.renderThreadPosts(threadId)}
					</div>
				</div>
				<div className={unreadsBelowClass} type="below" onClick={this.handleClickUnreads}>
					&darr; Unread Messages &darr;
				</div>
				<ComposeBox
					placeholder={placeholderText}
					teammates={this.props.teammates}
					slashCommands={this.props.slashCommands}
					ensureStreamIsActive={this.ensureStreamIsActive}
					ref={this._compose}
					disabled={this.props.isOffline}
					offscreen={activePanel !== "main" && activePanel !== "thread"}
					onSubmit={this.submitPost}
					onEmptyUpArrow={this.editLastPost}
					findMentionedUserIds={this.findMentionedUserIds}
					isDirectMessage={this.props.postStreamType === "direct"}
				/>
			</div>
		);
	}

	handleMouseDown = event => {
		// console.log("mouse is down");
	};

	handleClickStreamSettings = event => {
		this.setState({ openMenu: this.props.postStreamId, menuTarget: event.target });
		event.stopPropagation();
		return true;
	};

	closeMenu = () => {
		this.setState({ openMenu: null });
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

	editLastPost = event => {
		// find the most recent post I authored
		const postDiv = event.target.closest(".post");
		const seqNum = postDiv ? postDiv.dataset.seqNum : 9999999999;
		const editingPost = this.findMyPostBeforeSeqNum(seqNum);
		if (editingPost) this.setState({ editingPostId: editingPost.id });
	};

	showChannels = event => {
		this.setState({ activePanel: "channels" });
	};

	ensureStreamIsActive = () => {
		const { activePanel } = this.state;
		if (activePanel === "main" || activePanel === "thread") this.focusInput();
		else this.setState({ activePanel: "main" });
	};

	setActivePanel = panel => {
		if (panel !== this.state.activePanel) this.setState({ activePanel: panel });
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
		const scrolledOffBottom = offBottom > 100 ? true : null;
		// console.log("OB IS: ", offBottom);
		if (scrolledOffBottom != this.state.scrolledOffBottom)
			this.setState({ scrolledOffBottom: scrolledOffBottom });

		let unreadsAbove = null;
		let unreadsBelow = null;

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

	handleClickUnreads = event => {
		let scrollDiv = this._postslist;
		let umiDivs = scrollDiv.getElementsByClassName("unread");
		let type = event.target.getAttribute("type");
		console.log("TYPE IS: ", type);
		let active = type === "above" ? umiDivs[0] : umiDivs[umiDivs.length - 1];
		if (active) active.scrollIntoView(type === "above");
		// ...and then a little more, so it is off the border
		scrollDiv.scrollTop += type === "above" ? -10 : 10;
	};

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

	confirmDeletePost = postId => {
		confirmPopup({
			title: "Are you sure?",
			message: "Deleting a post cannot be undone.",
			centered: true,
			buttons: [
				{
					label: "Delete Post",
					action: () => this.props.deletePost(postId)
				},
				{ label: "Cancel" }
			]
		});
	};

	markUnread = postId => {
		this.props.markPostUnread(postId);
	};

	notImplementedYet = () => {
		return this.submitSystemPost("Not implemented yet");
	};

	invitePerson = args => {
		let email;
		let invitedEmails = [];
		while ((email = EMAIL_MATCH_REGEX.exec(args)) !== null) {
			this.props.invite({ email: email[0], teamId: this.props.teamId });
			invitedEmails.push(email[0]);
		}
		let invited = "";
		switch (invitedEmails.length) {
			case 0:
				return this.submitSystemPost("Usage: /invite [email address]");
			case 1:
				invited = invitedEmails[0];
				break;
			default:
				const lastOne = invitedEmails.pop();
				invited = invitedEmails.join(", ") + " and " + lastOne;
		}
		return this.submitSystemPost("Invited " + invited);
	};

	postAction = (action, post) => {
		switch (action) {
			case "make-thread":
				return this.selectPost(post.id, true);
			case "edit-post":
				return this.setState({ editingPostId: post.id });
			case "delete-post":
				return this.confirmDeletePost(post.id);
			case "mark-unread":
				return this.markUnread(post.id);
			case "add-reaction":
				return this.notImplementedYet();
			case "pin-to-stream":
				return this.notImplementedYet();
		}
	};

	findMentionedUserIds = (text, users) => {
		const mentionedUserIds = [];
		users.forEach(user => {
			const matcher = user.username.replace(/\+/g, "\\+").replace(/\./g, "\\.");
			if (text.match("@" + matcher + "\\b")) {
				mentionedUserIds.push(user.id);
			}
		});
		return mentionedUserIds;
	};

	replacePostText = (postId, newText) => {
		// convert the text to plaintext so there is no HTML
		const doc = new DOMParser().parseFromString(newText, "text/html");
		const replaceText = doc.documentElement.textContent;
		const mentionUserIds = this.findMentionedUserIds(replaceText, this.props.teammates);

		this.props.editPost(postId, replaceText, mentionUserIds);
	};

	// by clicking on the post, we select it
	handleClickPost = event => {
		var postDiv = event.target.closest(".post");
		if (!postDiv) return;

		// if they clicked a link, follow the link rather than selecting the post
		if (event && event.target && event.target.tagName === "A") return false;

		// console.log(event.target.id);
		if (event.target.id === "discard-button") {
			// if the user clicked on the cancel changes button,
			// presumably because she is editing a post, abort
			this.setState({ editingPostId: null });
			return;
		} else if (event.target.id === "save-button") {
			// if the user clicked on the save changes button,
			// save the new post text
			let newText = document
				.getElementById("input-div-" + postDiv.id)
				.innerHTML.replace(/<br>/g, "\n");

			this.replacePostText(postDiv.id, newText);
			this.setState({ editingPostId: null });
			return;
		} else if (postDiv.classList.contains("editing")) {
			// otherwise, if we aren't currently editing the
			// post, go to the thread for that post, but if
			// we are editing, then do nothing.
			return;
		} else if (postDiv.classList.contains("system-post")) {
			// otherwise, if we aren't currently editing the
			// post, go to the thread for that post, but if
			// we are editing, then do nothing.
			return;
		} else if (window.getSelection().toString().length > 0) {
			// in this case the user has selected a string
			// by dragging
			return;
		}
		this.selectPost(postDiv.id, true);
	};

	// show the thread related to the given post, and if there is
	// a codeblock, scroll to it and select it
	selectPost = (id, wasClicked = false) => {
		EventEmitter.emit("analytics", {
			label: "Page Viewed",
			payload: { "Page Name": "Thread View" }
		});
		const post = this.findPostById(id);
		if (!post) return;

		// if it is a child in the thread, it'll have a parentPostId,
		// otherwise use the id. any post can become the head of a thread
		const threadId = post.parentPostId || post.id;
		this.setState({ threadId: threadId, activePanel: "thread" });

		this.focusInput();
		if (wasClicked) {
			EventEmitter.emit("interaction:thread-selected", {
				threadId,
				streamId: this.props.postStreamId,
				post
			});
		}
	};

	// not using a gutter for now
	// installGutter() {
	// 	let editor = atom.workspace.getActiveTextEditor();
	// 	if (editor && !editor.gutterWithName("CodeStream")) {
	// 		editor.addGutter({ name: "CodeStream", priority: 150 });
	// 	}
	// }

	focusInput = () => {
		const input = document.getElementById("input-div");
		if (input) input.focus();
	};

	handleClickScrollToNewMessages = () => {
		this.scrollToBottom();
	};

	handleEscape(event) {
		if (this.state.editingPostId) this.handleDismissEdit();
		else if (this.state.activePanel === "thread") this.handleDismissThread();
		else event.abortKeyBinding();
	}

	handleDismissEdit() {
		this.setState({ editingPostId: null });
		this.focusInput();
	}

	// return true if we are able to use substitute
	// to edit the text of my last post
	substituteLastPost(substitute) {
		// nothing to substitute? return false
		if (!substitute) return false;

		// if we can't find my last post in the stream, return false
		const myLastPost = this.findMyPostBeforeSeqNum(9999999999);
		if (!myLastPost) return false;

		const find = substitute[1];
		const replace = substitute[2];
		// const modifier = substitute[3]; // not used yet
		const newText = myLastPost.text.replace(find, replace);
		if (newText !== myLastPost.text) {
			this.replacePostText(myLastPost.id, newText);
			return true;
		} else return false;
	}

	toggleMute = () => {
		const { postStreamId, postStreamType } = this.props;

		if (postStreamType === "direct") {
			const text = "You cannot mute direct message streams. Close them on the Channels list page.";
			return this.submitSystemPost(text);
		}

		const isMuted = this.props.mutedStreams[postStreamId];
		this.props.setUserPreference(["mutedStreams", postStreamId], !isMuted);
		const text = isMuted ? "This stream has been unmuted." : "This stream has been muted.";
		return this.submitSystemPost(text);
	};

	showMembers = () => {
		const memberIds = this.props.postStreamMemberIds;
		const streamName =
			this.props.postStreamType === "direct" ? "this DM" : this.props.postStreamName;

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

		return this.submitSystemPost(text);
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
		if (this.props.postStreamType === "direct") {
			const text =
				"You cannot add people to direct message streams. Create a larger conversation by clicking DIRECT MESSAGES from the channels panel.";
			return this.submitSystemPost(text);
		}
		if (users.length === 0) {
			return this.submitSystemPost("Add members to this channel by typing\n`/add @nickname`");
		} else {
			await this.props.addUsersToStream(this.props.postStreamId, users);
			return this.submitPost({ text: "/me added " + usernames });
		}
	};

	renameChannel = async args => {
		if (this.props.postStreamType === "direct") {
			const text = "You cannot rename a direct message stream.";
			return this.submitSystemPost(text);
		}
		if (args) {
			const oldName = this.props.postStreamName;
			const newStream = await this.props.renameStream(this.props.postStreamId, args);
			if (newStream && newStream.name === args)
				this.submitPost({ text: "/me renamed the channel from #" + oldName + " to #" + args });
			else
				this.submitSystemPost(
					"Unable to rename channel. Channel names must be unique. CodeStream doesn't support these characters: .~#%&*{}+/:<>?|'\"."
				);
		} else this.submitSystemPost("Rename a channel by typing `/rename [new name]`");
		return true;
	};

	setPurpose = async args => {
		if (this.props.postStreamType === "direct") {
			const text = "You cannot set a purpose in direct message streams.";
			return this.submitSystemPost(text);
		}
		if (args) {
			const newStream = await this.props.setPurpose(this.props.postStreamId, args);
			if (newStream.purpose === args)
				this.submitPost({ text: "/me set the channel purpose to " + args });
			else this.submitSystemPost("Unable to set channel purpose.");
		} else this.submitSystemPost("Set a channel purpose by typing `/purpose [new purpose]`");
		return true;
	};

	leaveChannel = () => {
		if (this.props.postStreamIsTeamStream) {
			const text = "You cannot leave all-hands channels.";
			return this.submitSystemPost(text);
		}
		const message = this.props.isPrivate
			? "Once you leave a private channel, you won't be able to re-join unless you are added by someone in the channel."
			: "Once you leave a public channel, you may re-join it in the future by looking at the channels list under TEAM CHANNELS.";
		confirmPopup({
			title: "Are you sure?",
			message,
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
		if (false && postStream.creatorId !== currentUser.id) {
			let text = "You may only archive channels that you created.";
			if (postStream.creatorId) text += " This channel was created by " + postStream.creatorId;
			return this.submitSystemPost(text);
		}
		if (this.props.postStreamType === "direct") {
			const text =
				"You cannot archive direct message streams. You can remove them from your list by clicking the X on the channels panel.";
			return this.submitSystemPost(text);
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
		const { postStream, currentUser } = this.props;
		console.log("Calling archive channel with: ", postStream.id);
		this.props.archiveStream(postStream.id, true);
		this.setActivePanel("channels");
	};

	removeFromStream = async args => {
		if (this.props.postStreamIsTeamStream) {
			const text = "You cannot remove people from all-hands channels.";
			return this.submitSystemPost(text);
		}
		if (this.props.postStreamType === "direct") {
			const text = "You cannot remove people from direct message streams.";
			return this.submitSystemPost(text);
		}
		const { users, usernames, rest } = this.extractUsersFromArgs(args);
		if (users.length === 0) {
			this.submitSystemPost("Usage: `/remove @user`");
		} else {
			await this.props.removeUsersFromStream(this.props.postStreamId, users);
			this.submitPost({ text: "/me removed " + usernames });
		}
		return true;
	};

	openStream = args => {
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

		if (!user) return this.submitSystemPost("Usage: `/msg @user message`");

		// find or create the stream, then select it, then post the message
		const stream = await this.props.createStream({ type: "direct", memberIds: [user] });
		if (stream && (stream._id || stream.id)) {
			this.submitPost({ text: tokens.join(" ").trim() });
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
		return true;
	};

	postHelp = () => {
		const text = "Get more help at help.codestream.com";
		this.submitSystemPost(text);
		return true;
	};

	postNotAllowedInDirectStreams = command => {
		const text = "`/" + command + "` not allowed in direct message streams.";
		this.submitSystemPost(text);
		return true;
	};

	postVersion = () => {
		const text = "This is CodeStream version " + this.props.pluginVersion + ".";
		this.submitSystemPost(text);
		return true;
	};

	runSlashCommand = (command, args) => {
		switch (command) {
			case "add":
				return this.addMembersToStream(args);
			case "archive":
				return this.archiveChannel(args);
			case "delete":
				return this.deleteChannel(args);
			case "help":
				return this.postHelp();
			case "invite":
				return this.invitePerson(args);
			case "leave":
				return this.leaveChannel(args);
			case "me":
				return false;
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
			case "purpose":
				return this.setPurpose(args);
			case "remove":
				return this.removeFromStream(args);
			case "rename":
				return this.renameChannel(args);
			case "version":
				return this.postVersion(args);
			case "who":
				return this.showMembers();
		}
	};

	checkForSlashCommands = text => {
		const substitute = text.match(/^s\/(.+)\/(.*)\/$/);
		if (substitute && this.substituteLastPost(substitute)) return true;

		const commandMatch = text.match(/^\/(\w+)\b\s*(.*)/);
		if (commandMatch) {
			const command = commandMatch[1];
			const args = commandMatch[2];
			return this.runSlashCommand(command, args);
		}

		return false;
	};

	// create a new post
	submitPost = ({ text, quote, mentionedUserIds, autoMentions }) => {
		const codeBlocks = [];
		const { activePanel } = this.state;
		const { postStreamId, fileStreamId, createPost, currentFile, repoId } = this.props;

		if (this.checkForSlashCommands(text)) return;

		let threadId = activePanel === "thread" ? this.state.threadId : null;

		const submit = () =>
			createPost(postStreamId, threadId, text, codeBlocks, mentionedUserIds, {
				autoMentions
			});

		if (quote) {
			let codeBlock = {
				code: quote.quoteText,
				location: quote.quoteRange,
				file: quote.file
			};

			codeBlocks.push(codeBlock);
			let title;
			let message;

			if (!quote.quoteSource) {
				title = "Missing Git Info";
				message =
					"This repo doesn’t appear to be managed by Git. When your teammates view this post, we won’t be able to connect the code block to the appropriate file in their IDE.";
			} else if (quote.quoteSource.remotes.length === 0) {
				title = "No remote URL";
				message = "This repo doesn’t have a remote URL configured.";
			}
			// }
			// case "noGit":
			// 	title = "Git not in path";
			// 	message =
			// 		"We aren’t able to find Git information for this repo because Git isn’t in your PATH.";
			// 	break;

			if (title)
				return confirmPopup({
					title,
					message: () => (
						<span>
							{message + " "}
							<a
								onClick={e => {
									e.preventDefault();
									EventEmitter.emit(
										"interaction:clicked-link",
										"https://help.codestream.com/hc/en-us/articles/360001530571-Git-Issues"
									);
								}}
							>
								Learn more
							</a>
						</span>
					),
					centered: true,
					buttons: [
						{
							label: "Post Anyway",
							action: submit
						},
						{ label: "Cancel" }
					]
				});
		}
		submit();
	};
}

const mapStateToProps = ({
	configs,
	connectivity,
	session,
	context,
	startOnMainPanel,
	streams,
	users,
	posts,
	messaging,
	teams,
	onboarding,
	umis
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

	// this usenames regexp is a pipe-separated list of
	// either usernames or if no username exists for the
	// user then his email address. it is sorted by length
	// so that the longest possible match will be made.
	const usernamesRegexp = teamMembers
		.map(user => {
			return user.username || "";
		})
		.sort(function(a, b) {
			return b.length - a.length;
		})
		.join("|")
		.replace(/\|\|+/g, "|") // remove blank identifiers
		.replace(/\+/g, "\\+") // replace + and . with escaped versions so
		.replace(/\./g, "\\."); // that the regexp matches the literal chars

	const isOffline =
		connectivity.offline || messaging.failedSubscriptions.length > 0 || messaging.timedOut;

	// FIXME -- eventually we'll allow the user to switch to other streams, like DMs and channels
	const teamStream = getStreamForTeam(streams, context.currentTeamId) || {};
	const postStream =
		getStreamForId(streams, context.currentTeamId, context.currentStreamId) || teamStream;
	const streamPosts = getPostsForStream(posts, postStream.id);

	const user = users[session.userId];
	const mutedStreams = (user && user.preferences && user.preferences.mutedStreams) || {};

	const channelMembers = postStream.isTeamStream
		? teamMembers
		: postStream.memberIds
			? postStream.memberIds.map(id => users[id])
			: [];

	return {
		startOnMainPanel,
		umis,
		configs,
		isOffline,
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
		usernamesRegexp: usernamesRegexp,
		currentUser: user,
		mutedStreams,
		slashCommands,
		team: teams[context.currentTeamId],
		channelMembers,
		posts: streamPosts.map(post => {
			let user = users[post.creatorId];
			if (!user) {
				if (post.creatorId === "codestream") {
					user = {
						username: "CodeStream",
						email: "",
						fullName: ""
					};
				} else {
					console.warn(
						`Redux store doesn't have a user with id ${post.creatorId} for post with id ${post.id}`
					);
					user = {
						username: "Unknown user",
						email: "",
						fullName: ""
					};
				}
			}
			const { username, email, fullName = "", color } = user;
			return {
				...post,
				author: {
					username,
					email,
					color,
					fullName
				}
			};
		})
	};
};

export default connect(mapStateToProps, {
	...actions
})(SimpleStream);
