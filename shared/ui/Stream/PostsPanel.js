import React from "react";
import _ from "underscore";
import { connect } from "react-redux";
import createClassString from "classnames";
import { FormattedMessage } from "react-intl";
import { confirmPopup } from "./Confirm";
import EventEmitter from "../event-emitter";
import ChannelMenu from "./ChannelMenu";
import ComposeBox from "./ComposeBox";
import DateSeparator from "./DateSeparator";
import Icon from "./Icon";
import Post from "./Post";
import { goToInvitePage } from "../actions/routing";
import * as actions from "./actions";
import { getStreamForRepoAndFile } from "../reducers/streams";

class Stream extends React.Component {
	state = {
		editingPostId: null,
		menuTarget: null, // can probably replace this with a ref on <Icon/>
		postWithNewMessageIndicator: null,
		openMenu: null,
		threadId: null,
		unreadsAbove: false,
		unreadsBelow: false
	};
	disposables = [];
	_compose = React.createRef();
	_postList = React.createRef();

	componentDidMount() {
		this.disposables.push(
			EventEmitter.on("interaction:marker-selected", this.handleMarkerSelected)
		);

		this.scrollToBottom();

		new ResizeObserver(this.scrollToBottom).observe(this._compose.current);
		new ResizeObserver(this.handleScroll).observe(this._postList.current);

		this._postList.current.addEventListener("scroll", this.handleScroll);

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
	}

	componentDidUpdate(prevProps, prevState) {
		const streamId = this.props.stream.id;
		const switchedStreams = prevProps.stream.id !== streamId;

		// if we are switching from a non-thread panel
		if (this.props.isActive && !prevProps.isActive) {
			// check to see if we should scroll to the bottom
			if (!this.state.scrolledOffBottom) this.scrollToBottom();
			setTimeout(() => {
				this.focusInput();
			}, 500);
		}

		// if (nextProps.fileStreamId && switchingFileStreams && nextProps.posts.length === 0) {
		// 	// TODO: is this still necessary? this was because there was no lazy loading and file streams were complex
		// 	// this.props.fetchPosts({ streamId: nextProps.fileStreamId, teamId: nextProps.teamId });
		// }

		if (prevProps.hasFocus !== this.props.hasFocus) this.handleScroll();

		// no longer necessary since you cant switch streams from thread view
		// if (switchedStreams) {
		// 	this.dismissThread({ track: false });
		// }

		let postWithNewMessageIndicator;

		if (prevProps.hasFocus && !this.props.hasFocus) {
			postWithNewMessageIndicator = null;
		}
		// if we just got the focus, mark the new stream read
		if (!prevProps.hasFocus && this.props.hasFocus) {
			this.checkMarkStreamRead();
			postWithNewMessageIndicator = null;
			if (this.props.currentUser && this.props.currentUser.lastReads) {
				postWithNewMessageIndicator = this.props.currentUser.lastReads[streamId];
			}
		}
		if (this.props.currentUser && this.props.currentUser.lastReads) {
			postWithNewMessageIndicator = this.props.currentUser.lastReads[streamId];
		}

		// if we just switched to a new stream, (eagerly) mark both old and new as read
		if (switchedStreams) {
			this.props.markStreamRead(streamId);
			this.props.markStreamRead(prevProps.stream.id);
		}

		if (prevState.postWithNewMessageIndicator !== postWithNewMessageIndicator)
			this.setState({ postWithNewMessageIndicator });

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
		if (
			this.props.hasFocus &&
			this.props.isActive &&
			!this.state.unreadsAbove &&
			!this.state.unreadsBelow
		) {
			try {
				if (this.props.currentUser.lastReads[this.props.stream.id]) {
					this.props.markStreamRead(this.props.stream.id);
				}
			} catch (e) {
				/* this.props.currentUser.lastReads is probably undefined */
			}
		}
	}

	scrollToBottom = force => {
		// don't scroll to bottom if we're in the middle of an edit,
		if (this.state.editingPostId && !force) return;
		if (this._postList.current) this._postList.current.scrollTop = 100000;
	};

	handleScroll = _event => {
		const scrollDiv = this._postList.current;
		if (!scrollDiv) {
			return;
		}
		const scrollTop = scrollDiv.scrollTop;
		const containerHeight = scrollDiv.parentNode.offsetHeight;
		const scrollHeight = scrollDiv.scrollHeight;
		const offBottom = scrollHeight - scrollTop - scrollDiv.offsetHeight;
		const scrolledOffBottom = offBottom > 100;
		if (scrolledOffBottom !== this.state.scrolledOffBottom) this.setState({ scrolledOffBottom });

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
		if (this.state.unreadsAbove !== unreadsAbove) this.setState({ unreadsAbove });
		if (this.state.unreadsBelow !== unreadsBelow) this.setState({ unreadsBelow });
	};

	// TODO: memoize this
	findPostById = id => this.props.posts.find(post => post.id === id);

	findMyPostBeforeSeqNum(seqNum) {
		const me = this.props.currentUser.username;
		return _.chain(this.props.posts)
			.filter(post => {
				return post.author.username === me && post.seqNum < seqNum;
			})
			.last()
			.value();
	}

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

	checkForSlashCommands = text => {
		const substitute = text.match(/^s\/(.+)\/(.*)\/$/);
		if (substitute && this.substituteLastPost(substitute)) return true;

		const commandMatch = text.match(/^\/(\w+)\b\s*(.*)/);
		if (commandMatch) {
			const command = commandMatch[1];
			const args = commandMatch[2];
			return this.props.runSlashCommand(command, args);
		}

		return false;
	};

	replacePostText = (postId, newText) => {
		// convert the text to plaintext so there is no HTML
		const doc = new DOMParser().parseFromString(newText, "text/html");
		const replaceText = doc.documentElement.textContent;
		const mentionUserIds = this.findMentionedUserIds(replaceText, this.props.teammates);

		this.props.editPost(postId, replaceText, mentionUserIds);
	};

	editLastPost = event => {
		// find the most recent post I authored
		const postDiv = event.target.closest(".post");
		const seqNum = postDiv ? postDiv.dataset.seqNum : 9999999999;
		const editingPost = this.findMyPostBeforeSeqNum(seqNum);
		if (editingPost) this.setState({ editingPostId: editingPost.id });
	};

	submitPost = ({ text, quote, mentionedUserIds, autoMentions }) => {
		const codeBlocks = [];
		const { threadId } = this.state;
		const { stream, fileStreamId, createPost, currentFile, repoId } = this.props;

		if (this.checkForSlashCommands(text)) return;

		if (quote) {
			let codeBlock = {
				code: quote.quoteText,
				location: quote.quoteRange,
				preContext: quote.preContext,
				postContext: quote.postContext,
				repoId,
				file: currentFile // this should come from the host
			};

			// if we have a streamId, send it. otherwise the
			// API server will create one based on the file
			// and the repoId.
			if (fileStreamId) codeBlock.streamId = fileStreamId;

			codeBlocks.push(codeBlock);
		}

		createPost(stream.id, threadId, text, codeBlocks, mentionedUserIds, {
			autoMentions
		});
	};

	handleMarkerSelected = ({ postId }) => {
		this.props.showPostsPanel();
		this.selectPost(postId);
	};

	handleEscape(event) {
		if (this.state.editingPostId) this.handleDismissEdit();
		else if (this.state.threadId) this.dismissThread();
		else event.abortKeyBinding();
	}

	handleClickStreamSettings = event => {
		this.setState({ openMenu: true, menuTarget: event.target });
		event.stopPropagation();
		return true;
	};

	closeMenu = () => {
		this.setState({ openMenu: false });
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

	focusInput = () => {
		const input = document.getElementById("input-div");
		if (input) input.focus();
	};

	// show the thread related to the given post, and if there is
	// a codeblock, scroll to it and select it
	selectPost = (id, wasClicked = false) => {
		EventEmitter.emit("analytics", {
			label: "Page Viewed",
			payload: { "Page Name": "Thread View" }
		});
		const post = this.props.posts.find(post => id === post.id);
		if (!post) return;

		// if it is a child in the thread, it'll have a parentPostId,
		// otherwise use the id. any post can become the head of a thread
		const threadId = post.parentPostId || post.id;
		this.setState({ threadId: threadId });

		this.focusInput();
		if (wasClicked) {
			EventEmitter.emit("interaction:thread-selected", {
				threadId,
				streamId: this.props.stream.id,
				post
			});
		}
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

	handleClickHelpLink = event => {
		event.preventDefault();
		EventEmitter.emit("interaction:clicked-link", "https://help.codestream.com");
	};

	// dismiss the thread stream and return to the main stream
	dismissThread = ({ track = true } = {}) => {
		EventEmitter.emit("interaction:thread-closed", this.findPostById(this.state.threadId));
		this.setState({ threadId: null });
		this.focusInput();
		if (track)
			EventEmitter.emit("analytics", {
				label: "Page Viewed",
				payload: { "Page Name": "Source Stream" }
			});
	};

	handleClickGoBack = event => {
		event.preventDefault();
		this.state.threadId ? this.dismissThread() : this.props.showChannels();
	};

	handleClickUnreads = event => {
		let scrollDiv = this._postslist;
		let umiDivs = scrollDiv.getElementsByClassName("unread");
		let type = event.target.getAttribute("type");

		let active = type === "above" ? umiDivs[0] : umiDivs[umiDivs.length - 1];
		if (active) active.scrollIntoView(type === "above");
		// ...and then a little more, so it is off the border
		scrollDiv.scrollTop += type === "above" ? -10 : 10;
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

	handleKeyDown = event => {
		event.preventDefault();
		this.dismissThread();
	};

	renderIntro = () => {
		return [
			<label key="welcome">
				<FormattedMessage id="stream.intro.welcome" defaultMessage="Welcome to CodeStream!" />
			</label>,
			<label key="info">
				<ul>
					<li>
						<FormattedMessage
							id="stream.intro.eachFile"
							defaultMessage="Post a message and any of your teammates can join the discussion."
						/>
					</li>
					<li>
						<FormattedMessage
							id="stream.intro.comment"
							defaultMessage={
								'Comment on a specific block of code by selecting it and then clicking the "+" button.'
							}
						/>
					</li>
					<li>
						<FormattedMessage
							id="stream.intro.share"
							defaultMessage="Select &quot;Codestream: Invite&quot; from the command palette to invite your team."
						>
							{() => (
								<React.Fragment>
									Select <a onClick={this.props.goToInvitePage}>Codestream: Invite</a> from the
									command palette to invite your team.
								</React.Fragment>
							)}
						</FormattedMessage>
					</li>
				</ul>
			</label>,
			<label key="learn-more">
				Learn more at <a onClick={this.handleClickHelpLink}>help.codestream.com</a>
			</label>
		];
	};

	renderPosts = threadId => {
		let lastTimestamp = 0;
		let unread = false;

		return this.props.posts.map(post => {
			if (post.deactivated) return null;
			if (threadId && threadId !== post.parentPostId) return null;
			// this needs to be done by storing the return value of the render,
			// then setting lastTimestamp, otherwise you wouldn't be able to
			// compare the current one to the prior one.
			const parentPost = this.findPostById(post.parentPostId);
			const newMessageIndicator =
				post.seqNum && post.seqNum === Number(this.state.postWithNewMessageIndicator);
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
						showDetails={Boolean(threadId)}
						editing={this.props.isActive && post.id === this.state.editingPostId}
						action={this.postAction}
					/>
				</div>
			);
			lastTimestamp = post.createdAt;
			return returnValue;
		});
	};

	render() {
		const { className, setActivePanel, umis } = this.props;

		const umisClass = createClassString({
			umis: true,
			"align-left-button": true,
			mentions: umis.totalMentions > 0,
			unread: umis.totalMentions == 0 && umis.totalUnread > 0
		});
		const totalUMICount = umis.totalMentions || umis.totalUnread || "";

		const inThread = this.state.threadId;

		const threadPost = this.findPostById(this.state.threadId);

		const placeholderText = inThread ? `Reply to ${threadPost.author.username}` : "Add comment";

		const channelIcon =
			this.props.stream.type === "direct" ? (
				<Icon name="organization" />
			) : this.props.stream.privacy === "private" ? (
				<Icon name="lock" />
			) : (
				<span>#</span>
			);

		return (
			<div
				className={createClassString("panel", "main-panel", "posts-panel", className)}
				onKeyPress={this.handleKeyPress}
				onKeyDown={this.handleKeyDown}
				onKeyUp={this.handleKeyUp}
			>
				{inThread ? (
					<div id="close-thread" className="panel-header" onClick={this.dismissThread}>
						<span className="align-left-button">
							<Icon name="chevron-left" className="show-channels-icon" />
						</span>
						<span className="panel-title">
							Back <span className="keybinding">(esc)</span>
						</span>
					</div>
				) : (
					<div className="panel-header">
						<span onClick={this.handleClickGoBack} className={umisClass}>
							<Icon name="chevron-left" className="show-channels-icon" />
							{totalUMICount && <label>{totalUMICount}</label>}
						</span>
						<span className="panel-title">
							{channelIcon} {this.props.stream.name}
						</span>
						{this.props.stream.type !== "direct" && (
							<span onClick={this.handleClickStreamSettings} className="align-right-button">
								<Icon name="gear" className="show-settings" />
								{this.state.openMenu && (
									<ChannelMenu
										stream={this.props.stream}
										target={this.state.menuTarget}
										umiCount={0}
										isMuted={this.props.isMuted}
										setActivePanel={setActivePanel}
										runSlashCommand={this.props.runSlashCommand}
										closeMenu={this.closeMenu}
									/>
								)}
							</span>
						)}
					</div>
				)}
				{inThread ? null : (
					<div
						className={createClassString({
							unreads: true,
							active: this.state.unreadsAbove
						})}
						type="above"
						onClick={this.handleClickUnreads}
					>
						&uarr; Unread Messages &uarr;
					</div>
				)}
				<div
					className={createClassString("postslist", { shrink: inThread })}
					onClick={this.handleClickPost}
					id={`stream-${this.props.stream.id}`}
					ref={this._postList}
				>
					<div className="intro" ref={ref => (this._intro = ref)}>
						{this.renderIntro()}
					</div>
					{this.renderPosts()}
				</div>
				<div
					className={createClassString("postslist", "threadlist", { active: inThread })}
					onClick={this.handleClickPost}
				>
					{threadPost && (
						<Post
							post={threadPost}
							usernames={this.props.usernamesRegexp}
							currentUsername={this.props.currentUser.username}
							key={threadPost.id}
							showDetails
							currentCommit={this.props.currentCommit}
							editing={this.props.isActive && threadPost.id === this.state.editingPostId}
							action={this.postAction}
						/>
					)}
					{this.renderPosts(this.state.threadId)}
				</div>
				<div
					className={createClassString({
						unreads: true,
						offscreen: !this.props.isActive,
						active: this.state.unreadsBelow
					})}
					type="below"
					onClick={this.handleClickUnreads}
				>
					&darr; Unread Messages &darr;
				</div>
				<ComposeBox
					placeholder={placeholderText}
					teammates={this.props.teammates}
					slashCommands={this.props.slashCommands}
					ensureStreamIsActive={this.props.showPostsPanel}
					ref={this._compose}
					disabled={this.props.isOffline}
					offscreen={!this.props.isActive}
					onSubmit={this.submitPost}
					onEmptyUpArrow={this.editLastPost}
					findMentionedUserIds={this.findMentionedUserIds}
					isDirectMessage={this.props.stream.type === "direct"}
				/>
			</div>
		);
	}
}

const mapStateToProps = state => {
	const { connectivity, context, messaging, session, streams, teams, users } = state;
	const teamMembers = teams[context.currentTeamId].memberIds.map(id => users[id]).filter(Boolean);

	const fileStream =
		getStreamForRepoAndFile(streams, context.currentRepoId, context.currentFile) || {};

	const isOffline =
		connectivity.offline || messaging.failedSubscriptions.length > 0 || messaging.timedOut;

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

	return {
		currentCommit: context.currentCommit,
		currentFile: context.currentFile,
		currentUser: users[session.userId],
		hasFocus: context.hasFocus,
		isOffline,
		fileStreamId: fileStream.id,
		repoId: context.currentRepoId,
		teammates: teamMembers.filter(({ id }) => id !== session.userId),
		umis: state.umis,
		usernamesRegexp
	};
};
export default connect(mapStateToProps, { ...actions, goToInvitePage })(Stream);
