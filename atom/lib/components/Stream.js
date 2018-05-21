import { shell } from "electron";
import React, { Component } from "react";
import { connect } from "react-redux";
import { FormattedMessage } from "react-intl";
import _ from "underscore-plus";
import mixpanel from "mixpanel-browser";
import ComposeBox from "./ComposeBox";
import Post from "./Post";
import createClassString from "classnames";
import DateSeparator from "./DateSeparator";
import withRepositories from "./withRepositories";
import * as streamActions from "../actions/stream";
import * as umiActions from "../actions/umi";
import * as routingActions from "../actions/routing";
import { createPost, editPost, deletePost, fetchPosts } from "../actions/post";
import { toMapBy } from "../reducers/utils";
import { rangeToLocation } from "../util/Marker";
import { getStreamForTeam, getStreamForRepoAndFile } from "../reducers/streams";
import { getPostsForStream } from "../reducers/posts";
import EditingIndicator from "./EditingIndicator";

export class SimpleStream extends Component {
	disposables = [];

	constructor(props) {
		super(props);

		this.state = {
			threadId: null,
			threadActive: false,
			fileForIntro: props.currentFile
		};
		this._compose = React.createRef();
	}

	componentDidMount() {
		window.addEventListener("message", this.handleInteractionEvent, true);

		// this listener pays attention to when the input field resizes,
		// presumably because the user has typed more than one line of text
		// in it, and calls a function to handle the new size
		new ResizeObserver(this.handleResizeCompose).observe(this._compose.current);

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
				}),
				atom.commands.add(".codestream .post.mine", "codestream:edit-headshot", {
					didDispatch: event => this.handleEditHeadshot(event),
					hiddenInCommandPalette: true
				}),
				atom.commands.add(".codestream .post.mine", "codestream:edit-post", {
					didDispatch: event => this.handleEditPost(event),
					hiddenInCommandPalette: true
				}),
				atom.commands.add(".codestream .post.mine", "codestream:delete-post", {
					didDispatch: event => this.handleDeletePost(event),
					hiddenInCommandPalette: true
				})
			);
		}
	}

	componentWillReceiveProps(nextProps) {
		const switchingFileStreams = nextProps.fileStreamId !== this.props.fileStreamId;
		const switchingPostStreams = nextProps.postStreamId !== this.props.postStreamId;

		if (nextProps.fileStreamId && switchingFileStreams && nextProps.posts.length === 0) {
			this.props.fetchPosts({ streamId: nextProps.fileStreamId, teamId: nextProps.teamId });
		}

		if (switchingPostStreams) {
			this.handleDismissThread({ track: false });

			// keep track of the new message indicator in "this" instead of looking
			// directly at currentUser.lastReads, because that will change and trigger
			// a re-render, which would remove the "new messages" line
			// console.log("Switch to: ", nextProps.postStreamId);
		}
		// this.postWithNewMessageIndicator = 10;

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
		window.removeEventListener("message", this.handleInteractionEvent, true);
		this.disposables.forEach(d => d.dispose());
	}

	handleInteractionEvent = ({ data }) => {
		if (data.type === "codestream:interaction:marker-selected") {
			this.selectPost(data.body.postId);
		}
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
			this.resizeStream();
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
			this.resizeStream();
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

		// FIXME this doesn't seem to always scroll to the bottom when it should
		if (this.state.editingPostId !== prevState.editingPostId) {
			// special-case the editing of the bottom-most post...
			// scroll it into view. in all other cases we let the
			// focus of the input field make sure the post is focused
			const lastPost = this.props.posts[this.props.posts.length - 1];
			if (this.state.editingPostId == lastPost.id) this.scrollToBottom(true);
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
		console.log("OFF BOTTOM IS: ", offBottom);
		if (offBottom < 100) this.scrollToBottom();
	};

	scrollToBottom = force => {
		// don't scroll to bottom if we're in the middle of an edit,
		// unless the force parameter is called
		if (this.state.editingPostId && !force) return;
		if (this._postslist) this._postslist.scrollTop = 100000;
	};

	calculateScrolledOffBottom = () => {};

	// return the post, if any, with the given ID
	findPostById(id) {
		return this.props.posts.find(post => id === post.id);
	}

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
				Learn more at{" "}
				<a onClick={_e => shell.openExternal("https://help.codestream.com")}>help.codestream.com</a>
			</label>
		];
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
		const { configs, posts } = this.props;

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
			"main-panel": true,
			"inactive-panel": this.state.threadActive
		});
		const threadPanelClass = createClassString({
			"thread-panel": true,
			"inactive-panel": !this.state.threadActive
		});

		let lastTimestamp = null;
		let threadId = this.state.threadId;
		let threadPost = this.findPostById(threadId);

		let placeholderText = "Add comment";
		if (this.state.threadActive && threadPost) {
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
			active: this.state.unreadsBelow
		});
		const unreadsAbove = this.state.threadActive ? null : (
			<div className={unreadsAboveClass} type="above" onClick={this.handleClickUnreads}>
				&uarr; Unread Messages &uarr;
			</div>
		);

		const teamName = this.props.team ? this.props.team.name : "";

		return (
			<div className={streamClass} ref={ref => (this._div = ref)}>
				<EditingIndicator
					editingUsers={this.props.editingUsers}
					inactive={this.state.threadActive} // or if no fileStream
					currentUser={this.props.currentUser}
					teamMembers={this.props.teamMembersById}
				/>
				<div className={mainPanelClass} ref={ref => (this._mainPanel = ref)}>
					<div className="stream-header" ref={ref => (this._header = ref)}>
						<span>{teamName}</span>
						<span onClick={this.props.goToInvitePage} className="icon icon-organization" />
					</div>
					{unreadsAbove}
					<div
						className={postsListClass}
						ref={ref => (this._postslist = ref)}
						onClick={this.handleClickPost}
						id={streamDivId}
					>
						<div className="intro" ref={ref => (this._intro = ref)}>
							{this.renderIntro()}
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
								post.seqNum && post.seqNum === Number(this.postWithNewMessageIndicator);
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
										editing={!this.state.threadActive && post.id === this.state.editingPostId}
									/>
								</div>
							);
							lastTimestamp = post.createdAt;
							return returnValue;
						})}
					</div>
				</div>
				<div className={threadPanelClass}>
					<div id="close-thread" className="stream-header" onClick={this.handleDismissThread}>
						<span>&lt; Back to Stream </span>
						<span className="keybinding">[esc]</span>
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
								editing={this.state.threadActive && threadPost.id === this.state.editingPostId}
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
					ref={this._compose}
					disabled={this.props.isOffline}
					onSubmit={this.submitPost}
					onEmptyUpArrow={this.editLastPost}
					findMentionedUserIds={this.findMentionedUserIds}
				/>
			</div>
		);
	}

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
		console.log("up! ", event);
		const postDiv = event.target.closest(".post");
		const seqNum = postDiv ? postDiv.dataset.seqNum : 9999999999;
		const editingPost = this.findMyPostBeforeSeqNum(seqNum);
		if (editingPost) this.setState({ editingPostId: editingPost.id });
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
		window.parent.postMessage(
			{
				type: "codestream:interaction:thread-closed",
				body: this.findPostById(this.state.threadId)
			},
			"*"
		);
		this.setState({ threadActive: false });
		this.focusInput();
		if (track) mixpanel.track("Page Viewed", { "Page Name": "Source Stream" });
	};

	handleEditHeadshot = _event => {
		atom.confirm({
			message: "Edit Headshot",
			detailedMessage:
				"Until we have built-in CodeStream headshots, you can edit your headshot by setting it up on Gravatar.com for " +
				this.props.currentUser.email +
				".\n\nNote that it might take a few minutes for your headshot to appear here.\n\n-Team CodeStream"
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

		const answer = atom.confirm({
			message: "Are you sure?",
			buttons: ["Delete Post", "Cancel"]
		});

		if (answer === 0) {
			console.log("Calling delete post with: ", postDiv.id);
			this.props.deletePost(postDiv.id);
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
		mixpanel.track("Page Viewed", { "Page Name": "Thread View" });
		const post = this.findPostById(id);
		if (!post) return;

		// if it is a child in the thread, it'll have a parentPostId,
		// otherwise use the id. any post can become the head of a thread
		const threadId = post.parentPostId || post.id;
		this.setState({ threadId: threadId, threadActive: true });

		this.focusInput();
		if (wasClicked) {
			window.parent.postMessage(
				{
					type: "codestream:interaction:thread-selected",
					body: { threadId, streamId: this.props.postStreamId, post }
				},
				"*"
			);
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
		else if (this.state.threadActive) this.handleDismissThread();
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

	// create a new post
	submitPost = ({ text, quote, mentionedUserIds, autoMentions }) => {
		const codeBlocks = [];
		const { threadActive } = this.state;
		const { postStreamId, fileStreamId, createPost, currentFile, repoId } = this.props;

		const substitute = text.match(/^s\/(.+)\/(.*)\/$/);
		if (this.substituteLastPost(substitute)) return;
		else console.log("did not substitute");

		let threadId = threadActive ? this.state.threadId : null;

		if (quote) {
			let codeBlock = {
				code: quote.quoteText,
				location: rangeToLocation(quote.quoteRange),
				preContext: quote.preContext,
				postContext: quote.postContext,
				repoId,
				file: currentFile
			};

			// if we have a streamId, send it. otherwise the
			// API server will create one based on the file
			// and the repoId.
			if (fileStreamId) codeBlock.streamId = fileStreamId;

			codeBlocks.push(codeBlock);
		}

		const editor = atom.workspace.getActiveTextEditor();
		const editorText = editor ? editor.getText() : undefined;

		createPost(postStreamId, threadId, text, codeBlocks, mentionedUserIds, editorText, {
			autoMentions
		});
	};
}

const mapStateToProps = ({
	configs,
	connectivity,
	session,
	context,
	streams,
	users,
	posts,
	messaging,
	teams,
	onboarding
}) => {
	const fileStream =
		getStreamForRepoAndFile(streams, context.currentRepoId, context.currentFile) || {};

	const teamMembers = teams[context.currentTeamId].memberIds.map((id, index) => {
		const user = users[id];
		user.color = index % 10;
		if (!user.username) {
			let email = user.email;
			if (email) user.username = email.replace(/@.*/, "");
		}
		return user;
	});

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
	const streamPosts = getPostsForStream(posts, teamStream.id);

	return {
		configs,
		isOffline,
		teamMembersById: toMapBy("id", teamMembers),
		teammates: teamMembers.filter(({ id }) => id !== session.userId),
		postStreamId: teamStream.id,
		fileStreamId: fileStream.id,
		teamId: context.currentTeamId,
		repoId: context.currentRepoId,
		hasFocus: context.hasFocus,
		firstTimeInAtom: onboarding.firstTimeInAtom,
		currentFile: context.currentFile,
		currentCommit: context.currentCommit,
		editingUsers: fileStream.editingUsers,
		usernamesRegexp: usernamesRegexp,
		currentUser: users[session.userId],
		team: teams[context.currentTeamId],
		posts: streamPosts.map(post => {
			let user = users[post.creatorId];
			if (!user) {
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
			const { username, email, firstName = "", lastName = "", color } = user;
			return {
				...post,
				author: { username, email, color, fullName: `${firstName} ${lastName}`.trim() }
			};
		})
	};
};

export default connect(mapStateToProps, {
	...streamActions,
	...umiActions,
	fetchPosts,
	createPost,
	editPost,
	deletePost,
	goToInvitePage: routingActions.goToInvitePage
})(withRepositories(SimpleStream));
