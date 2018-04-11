import { shell } from "electron";
import { CompositeDisposable } from "atom";
import React, { Component } from "react";
import { connect } from "react-redux";
import ContentEditable from "react-contenteditable";
import { FormattedMessage } from "react-intl";
import _ from "underscore-plus";
import Raven from "raven-js";
import mixpanel from "mixpanel-browser";
import Post from "./Post";
import UMIs from "./UMIs";
import AtMentionsPopup from "./AtMentionsPopup";
import BufferReferences from "./BufferReferences";
import AddCommentPopup from "./AddCommentPopup2";
import MarkerLocationTracker from "./MarkerLocationTracker";
import createClassString from "classnames";
import DateSeparator from "./DateSeparator";
import withRepositories from "./withRepositories";
var Blamer = require("../util/blamer");
import * as streamActions from "../actions/stream";
import * as umiActions from "../actions/umi";
import * as routingActions from "../actions/routing";
import { createPost, editPost, deletePost, fetchPosts } from "../actions/post";
import { toMapBy } from "../reducers/utils";
import { rangeToLocation } from "../util/Marker";
import { getStreamForRepoAndFile } from "../reducers/streams";
import { getPostsForStream } from "../reducers/posts";
import rootLogger from "../util/Logger";
import Button from "./onboarding/Button";
import EditingIndicator from "./EditingIndicator";

const Path = require("path");
const logger = rootLogger.forClass("components/Stream");

const isBlankContent = (buffer, row, startColumn, endColumn) => {
	const line = buffer.lineForRow(row);
	const content = line.substring(startColumn, endColumn);
	const isBlank = content.trim() === "";

	return isBlank;
};

const lastColumnInRow = (buffer, row) => {
	const line = buffer.lineForRow(row);
	const lastColumn = line.length;

	return lastColumn;
};

const trimSelection = editor => {
	const range = editor.getSelectedBufferRange();
	const buffer = editor.getBuffer();
	let { start, end } = range;

	while (start.row < end.row) {
		if (isBlankContent(buffer, start.row, start.column)) {
			start.row++;
			start.column = 0;
		} else if (isBlankContent(buffer, end.row, 0, end.column)) {
			end.row--;
			end.column = lastColumnInRow(buffer, end.row);
		} else {
			break;
		}
	}

	editor.setSelectedBufferRange(range);
};

export class SimpleStream extends Component {
	subscriptions = null;
	insertedAuthors = "";

	constructor(props) {
		super(props);

		// FIXME -- this stuff shouldn't be stored here
		this.projectBlamers = {};
		this.blameData = {};
		// end FIXME

		this.state = {
			stream: {},
			threadId: null,
			threadActive: false,
			posts: [],
			fileForIntro: props.currentFile,
			newPostText: "",
			whoModified: {},
			autoMentioning: []
		};

		this.savedComposeState = {};
		this.editorsWithHandlers = {};

		this.subscriptions = new CompositeDisposable();
		this.subscriptions.add(
			atom.keymaps.add("codestream", {
				"atom-workspace": {
					escape: "codestream:escape",
					"cmd-c": "codestream:copy"
				}
			})
		);
		this.subscriptions.add(
			atom.commands.add(".codestream .compose.mentions-on", {
				"codestream:at-mention-move-up": event => this.handleAtMentionKeyPress(event, "up"),
				"codestream:at-mention-move-down": event => this.handleAtMentionKeyPress(event, "down"),
				"codestream:at-mention-tab": event => this.handleAtMentionKeyPress(event, "tab"),
				"codestream:at-mention-escape": event => this.handleAtMentionKeyPress(event, "escape")
			})
		);
		this.subscriptions.add(
			atom.commands.add("atom-workspace", {
				"codestream:escape": event => this.handleEscape(event),
				"codestream:copy": event => this.copy(event)
			})
		);
		this.subscriptions.add(
			atom.commands.add("atom-workspace", {
				"codestream:comment": event => this.handleClickAddComment(),
				"codestream:focus-input": event => this.toggleFocusInput()
			})
		);
		this.subscriptions.add(
			atom.commands.add(".codestream .post.mine", {
				"codestream:edit-headshot": event => this.handleEditHeadshot(event),
				"codestream:edit-post": event => this.handleEditPost(event),
				"codestream:delete-post": event => this.handleDeletePost(event)
			})
		);
	}

	copy(event) {
		let selectedText = window.getSelection().toString();
		atom.clipboard.write(selectedText);
		event.abortKeyBinding();
	}

	componentWillUnmount() {
		let editor = atom.workspace.getActiveTextEditor();
		if (editor) delete this.editorsWithHandlers[editor.id];
		this.subscriptions.dispose();
	}

	componentDidMount() {
		const me = this;
		// TODO: scroll to bottom

		const inputDiv = document.querySelector('div[contenteditable="true"]');
		if (!inputDiv) return;

		// this listener pays attention to when the input field resizes,
		// presumably because the user has typed more than one line of text
		// in it, and calls a function to handle the new size
		new ResizeObserver(me.handleResizeCompose).observe(me._compose);

		// so that HTML doesn't get pasted into the input field. without this,
		// HTML would be rendered as HTML when pasted
		inputDiv.addEventListener("paste", function(e) {
			e.preventDefault();
			const text = e.clipboardData.getData("text/plain");
			document.execCommand("insertHTML", false, text);
		});
		this.installEditorHandlers();
	}

	componentWillReceiveProps(nextProps) {
		const switchingStreams = nextProps.id !== this.props.id;

		if (nextProps.id && switchingStreams && nextProps.posts.length === 0) {
			this.props.fetchPosts({ streamId: nextProps.id, teamId: nextProps.teamId });
		}

		if (switchingStreams) {
			this.saveComposeState(nextProps.id);
			this.handleDismissThread({ track: false });

			// keep track of the new message indicator in "this" instead of looking
			// directly at currentUser.lastReads, because that will change and trigger
			// a re-render, which would remove the "new messages" line
			this.postWithNewMessageIndicator = null;
			if (this.props.currentUser && this.props.currentUser.lastReads) {
				this.postWithNewMessageIndicator = this.props.currentUser.lastReads[nextProps.id];
			}
			// console.log("Switch to: ", nextProps.id);
		}

		const switchingFiles = nextProps.currentFile !== this.props.currentFile;
		if (switchingFiles || nextProps.currentCommit !== this.props.currentCommit) {
			const editor = atom.workspace.getActiveTextEditor();
			if (editor) {
				// console.log("NEXTPROPS FILE: ", nextProps.currentFile);
				// console.log("EDITOR    FILE: ", editor.getPath());
				this.checkModifiedTyping(editor);
				this.checkModifiedGit(editor);
			}
		}

		if (nextProps.firstTimeInAtom && !Boolean(this.state.fileForIntro)) {
			this.setState({ fileForIntro: nextProps.currentFile });
		}
	}

	componentDidUpdate(prevProps, prevState) {
		const { id, markStreamRead, markStreamModified } = this.props;

		this._postslist.scrollTop = 100000;

		this.installEditorHandlers();

		// if we just switched to a new stream, (eagerly) mark both old and new as read
		if (id !== prevProps.id) {
			markStreamRead(id);

			markStreamRead(prevProps.id);
			this.resizeStream();
		}

		if (prevState.threadId !== this.state.threadId) {
			this.resizeStream();
		}

		if (
			prevState.modifiedGit != this.state.modifiedGit ||
			prevState.modifiedTyping != this.state.modifiedTyping
		) {
			let isModified = this.state.modifiedGit || this.state.modifiedTyping;
			// console.log("Marking this stream modified: " + id + " as " + isModified);
			markStreamModified(id, isModified);
		}
	}

	showDisplayMarker(markerId) {
		// FIXME -- switch to stream if code is from another buffer
		const editor = atom.workspace.getActiveTextEditor();
		const displayMarkers = editor.displayMarkers;

		if (!displayMarkers) {
			return;
		}

		const displayMarker = displayMarkers[markerId];
		if (displayMarker) {
			const start = displayMarker.getBufferRange().start;

			editor.setCursorBufferPosition(start);
			editor.scrollToBufferPosition(start, {
				center: true
			});

			this.displayMarkerDecoration = editor.decorateMarker(displayMarker, {
				type: "highlight",
				class: "codestream-highlight"
			});
		}
	}

	hideDisplayMarker() {
		const decoration = this.displayMarkerDecoration;
		if (decoration) {
			decoration.destroy();
		}
	}

	installEditorHandlers() {
		const editor = atom.workspace.getActiveTextEditor();
		if (!editor) {
			return;
		}

		if (!this.editorsWithHandlers[editor.id]) {
			let scrollViewDiv = editor.component.element.querySelector(".scroll-view");
			if (scrollViewDiv) {
				editor.resizeHandler = new ResizeObserver(() => {
					this.handleResizeWindow(scrollViewDiv);
				}).observe(scrollViewDiv);
			}

			this.subscriptions.add(
				editor.onDidStopChanging(() => {
					this.checkModifiedTyping(editor);
				}),
				editor.onDidSave(() => {
					this.checkModifiedTyping(editor);
					this.checkModifiedGit(editor);
				})
			);
			this.checkModifiedTyping(editor);
			this.checkModifiedGit(editor);
			this.selectionHandler = editor.onDidChangeSelectionRange(this.hideDisplayMarker.bind(this));
			this.editorsWithHandlers[editor.id] = true;
		}
	}

	// setStateWhoModified(value) {
	// 	let whoModified = this.state.whoModified || {};
	// 	if (value) whoModified[this.props.currentUser.id] = true;
	// 	else delete whoModified[this.props.currentUser.id];
	// 	this.setState({ whoModified });
	// }

	checkModifiedTyping(editor) {
		let isModified = editor.isModified();
		// if there's no change, no need to set state
		// console.log("Checking modified typing: " + isModified);
		this.setState({ modifiedTyping: isModified });
	}

	checkModifiedGit(editor) {
		if (!editor) return;
		let filePath = editor.getPath();
		let repo = this.props.repositories[0];
		let isModified = repo.isPathModified(filePath);
		// console.log("Checking modified git: " + isModified);
		this.setState({ modifiedGit: isModified });
	}

	handleResizeCompose = () => {
		this.resizeStream();
	};

	handleResizeWindow = scrollViewDiv => {
		// if the div has display: none then there will be no width
		if (!scrollViewDiv || !scrollViewDiv.offsetWidth) return;

		let rect = scrollViewDiv.getBoundingClientRect();
		// FIXME -- if there is panel is on the right, then subtract 20 more
		let width = scrollViewDiv.offsetWidth + rect.left;
		let newStyle = ".codestream-comment-popup { left: " + width + "px; }";
		this.addStyleString(newStyle);
		this.resizeStream();
	};

	// add a style to the document, reusing a style node that we attach to the DOM
	addStyleString(str) {
		let node = document.getElementById("codestream-style-tag") || document.createElement("style");
		node.id = "codestream-style-tag";
		node.innerHTML = str;
		document.body.appendChild(node);
	}

	resizeStream = () => {
		if (!this._div || !this._compose) return;
		const streamHeight = this._div.offsetHeight;
		const postslistHeight = this._postslist.offsetHeight;
		const composeHeight = this._compose.offsetHeight;
		if (postslistHeight < streamHeight) {
			let newHeight = streamHeight - postslistHeight + this._intro.offsetHeight - composeHeight;
			this._intro.style.height = newHeight + "px";
		}
		this._div.style.paddingBottom = composeHeight + "px";
		this._threadpostslist.style.height = postslistHeight + "px";
		// if (this._atMentionsPopup)
		// this._atMentionsPopup.style.bottom = this._compose.offsetHeight + "px";
		this._postslist.scrollTop = 100000;
	};

	// return the post, if any, with the given ID
	findPostById(id) {
		return this.props.posts.find(post => id === post.id);
	}

	// return a simple identifying string to represent the current path.
	// example is /path/to/foo.bar would just return "foo.bar"
	// FIXME -- this should be improved for systems that don't use "/"
	// as a path delimiter
	fileAbbreviation() {
		if (!this.props.currentFile) return "";
		return Path.basename(this.props.currentFile);
	}

	renderIntro = () => {
		if (
			!this.props.currentFile ||
			(this.props.firstTimeInAtom && this.props.currentFile === this.state.fileForIntro)
		) {
			return [
				<label key="welcome">
					<FormattedMessage id="stream.intro.welcome" defaultMessage="Welcome to CodeStream!" />
				</label>,
				<label key="info">
					<ul>
						<li>
							<FormattedMessage
								id="stream.intro.eachFile"
								defaultMessage="Pick a source file, post a message, and any of your teammates can join the discussion."
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
					<a onClick={e => shell.openExternal("https://help.codestream.com")}>
						help.codestream.com
					</a>.
				</label>
			];
		}
		return [
			<label>
				This is the start of your discussion about <b>{this.fileAbbreviation()}</b>.
			</label>,
			<label>
				Need people to chat with? <a onClick={this.props.goToInvitePage}>Invite someone!</a>
			</label>
		];
	};

	// we render both a main stream (postslist) plus also a postslist related
	// to the currently selected thread (if it exists). the reason for this is
	// to be able to animate between the two streams, since they will both be
	// visible during the transition
	render() {
		const posts = this.props.posts;
		const editor = atom.workspace.getActiveTextEditor();

		const streamClass = createClassString({
			stream: true,
			"no-headshots": !atom.config.get("CodeStream.showHeadshots")
		});
		const composeClass = createClassString({
			compose: true,
			"mentions-on": this.state.atMentionsOn
		});
		const postsListClass = createClassString({
			postslist: true,
			inactive: this.state.threadActive
		});
		const threadPostsListClass = createClassString({
			postslist: true,
			threadlist: true,
			inactive: !this.state.threadActive
		});

		let newPostText = this.state.newPostText || "";

		// strip out the at-mention markup, and add it back.
		// newPostText = newPostText.replace(/(@\w+)/g, '<span class="at-mention">$1</span> ');

		let quoteInfo = this.state.quoteText ? <div className="code">{this.state.quoteText}</div> : "";
		// FIXME loc
		let range = this.state.quoteRange;
		let rangeText = null;
		if (range) {
			if (range.start.row == range.end.row) {
				rangeText = "Commenting on line " + (range.start.row + 1);
			} else {
				rangeText = "Commenting on lines " + (range.start.row + 1) + "-" + (range.end.row + 1);
			}
		}
		let quoteHint = rangeText ? (
			<div className="hint">
				{rangeText}
				<span onClick={this.handleClickDismissQuote} className="icon icon-x" />
			</div>
		) : (
			""
		);

		let lastTimestamp = null;
		let threadId = this.state.threadId;
		let threadPost = this.findPostById(threadId);
		let hasNewMessagesBelowFold = false;

		let fileAbbreviation = this.fileAbbreviation();
		let placeholderText = "Add comment to " + fileAbbreviation;
		if (this.state.threadActive && threadPost) {
			placeholderText = "Reply to " + threadPost.author.username;
		}

		// this is a hack to create a unique class name for each stream
		// (based on the placeholder) which serves to re-render the
		// contenteditable div whenever the placeholder text changes
		// (i.e. you switch streams, or view a thread)
		// the bogus string created by btoa is just a one-way function
		// which will always create the same string for the same
		// placeholder text
		const contentEditableClass = "native-key-bindings " + btoa(placeholderText);

		return (
			<div className={streamClass} ref={ref => (this._div = ref)}>
				<UMIs />
				<BufferReferences
					streamId={this.props.id}
					references={this.props.markers}
					onSelect={this.selectPost}
				/>
				<MarkerLocationTracker editor={editor} />
				<EditingIndicator
					editingUsers={this.props.editingUsers}
					modifiedTyping={this.state.modifiedTyping}
					modifiedGit={this.state.modifiedGit}
					currentFile={this.props.currentFile}
					inactive={this.state.threadActive}
					currentUser={this.props.currentUser}
					users={this.props.users}
				/>
				<div
					className={postsListClass}
					ref={ref => (this._postslist = ref)}
					onClick={this.handleClickPost}
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
						const returnValue = (
							<div key={post.id}>
								<DateSeparator timestamp1={lastTimestamp} timestamp2={post.createdAt} />
								<Post
									post={post}
									usernames={this.props.usernamesRegexp}
									currentUsername={this.props.currentUser.username}
									replyingTo={parentPost}
									newMessageIndicator={
										post.seqNum && post.seqNum === Number(this.postWithNewMessageIndicator)
									}
									editing={post.id === this.state.editingPostId}
								/>
							</div>
						);
						lastTimestamp = post.createdAt;
						return returnValue;
					})}
				</div>

				<div
					className={threadPostsListClass}
					ref={ref => (this._threadpostslist = ref)}
					onClick={this.handleClickPost}
				>
					<Button id="close-thread" className="control-button" onClick={this.handleDismissThread}>
						Back to stream <span className="keystroke">escape</span>
					</Button>
					{threadPost && (
						<Post
							post={threadPost}
							usernames={this.props.usernamesRegexp}
							currentUsername={this.props.currentUser.username}
							key={threadPost.id}
							showDetails="1"
							currentCommit={this.props.currentCommit}
							editing={threadPost.id === this.state.editingPostId}
						/>
					)}
					{
						(lastTimestamp =
							0 ||
							posts.map(post => {
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
							}))
					}
				</div>

				<AtMentionsPopup
					on={this.state.atMentionsOn}
					people={this.state.atMentionsPeople}
					usernames={this.usernameRegExp}
					prefix={this.state.atMentionsPrefix}
					selected={this.state.selectedAtMention}
					handleHoverAtMention={this.handleHoverAtMention}
					handleSelectAtMention={this.handleSelectAtMention}
				/>
				{this.props.currentFile && (
					<div
						className={composeClass}
						onKeyPress={this.handleOnKeyPress}
						ref={ref => (this._compose = ref)}
					>
						<AddCommentPopup editor={editor} onClick={this.handleClickAddComment} />
						{hasNewMessagesBelowFold && (
							<div className="new-messages-below" onClick={this.handleClickScrollToNewMessages}>
								&darr; Unread Messages &darr;
							</div>
						)}
						{quoteInfo}
						{quoteHint}
						<ContentEditable
							className={contentEditableClass}
							id="input-div"
							rows="1"
							tabIndex="-1"
							onChange={this.handleOnChange}
							onBlur={this.handleOnBlur}
							html={newPostText}
							placeholder={placeholderText}
							ref={ref => (this._contentEditable = ref)}
						/>
					</div>
				)}
			</div>
		);
	}

	saveComposeState(nextId) {
		this.savedComposeState[this.props.id] = {
			newPostText: this.state.newPostText,
			quoteRange: this.state.quoteRange,
			quoteText: this.state.quoteText,
			preContext: this.state.preContext,
			postContext: this.state.postContext
		};
		this.resetCompose(this.savedComposeState[nextId]);
		delete this.savedComposeState[nextId];
	}

	// dismiss the thread stream and return to the main stream
	handleDismissThread = ({ track = true } = {}) => {
		this.hideDisplayMarker();
		this.setState({ threadActive: false });
		if (track) mixpanel.track("Page Viewed", { "Page Name": "Source Stream" });
	};

	handleEditHeadshot = event => {
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

			// convert the text to plaintext so there is no HTML
			var doc = new DOMParser().parseFromString(newText, "text/html");
			newText = doc.documentElement.textContent;
			const mentionUserIds = this.findMentions(newText);

			this.props.editPost(postDiv.id, newText, mentionUserIds);
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
		this.selectPost(postDiv.id);
	};

	findMentions = text => {
		let mentionUserIds = [];
		Object.keys(this.props.users).forEach(personId => {
			let person = this.props.users[personId];
			if (!person) return;
			let matcher = person.username.replace(/\+/g, "\\+").replace(/\./g, "\\.");
			if (text.match("@" + matcher + "\\b")) {
				mentionUserIds.push(personId);
			}
		});
		return mentionUserIds;
	};

	// show the thread related to the given post, and if there is
	// a codeblock, scroll to it and select it
	selectPost = id => {
		mixpanel.track("Page Viewed", { "Page Name": "Thread View" });
		const post = this.findPostById(id);
		if (!post) return;

		// if it is a child in the thread, it'll have a parentPostId,
		// otherwise use the id. any post can become the head of a thread
		const threadId = post.parentPostId || post.id;
		this.setState({ threadId: threadId, threadActive: true });

		if (post.codeBlocks && post.codeBlocks.length) {
			const codeBlock = post.codeBlocks[0];
			this.hideDisplayMarker();
			this.showDisplayMarker(codeBlock.markerId);
		}
	};

	// not using a gutter for now
	// installGutter() {
	// 	let editor = atom.workspace.getActiveTextEditor();
	// 	if (editor && !editor.gutterWithName("CodeStream")) {
	// 		editor.addGutter({ name: "CodeStream", priority: 150 });
	// 	}
	// }

	// programatically set the text in the composition box
	setNewPostText(text) {
		// text = text.replace(/<span class="at-mention">(@\w+)<\/span> /g, "$1");
		// text = text.replace(/(@\w+)/g, <span class="at-mention">$1</span>);
		// this._contentEditable.htmlEl.innerHTML = text;
		this.setState({ newPostText: text });
	}

	// toggle focus between the buffer and the compose input field
	toggleFocusInput = () => {
		if (document.activeElement && document.activeElement.id == "input-div")
			atom.workspace.getCenter().activate();
		else this.focusInput();
	};

	focusInput = () => {
		const input = document.getElementById("input-div");
		if (input) input.focus();
	};

	handleClickScrollToNewMessages = () => {
		this._postslist.scrollTop = 100000;
	};

	handleClickDismissQuote = () => {
		// not very React-ish but not sure how to set focus otherwise
		this.focusInput();

		let newState = {
			quoteText: "",
			preContext: "",
			postContext: "",
			quoteRange: null
		};

		// remove any at-mentions that we have added manually
		if (
			this.state.newPostText.replace(/&nbsp;/g, " ").trim() === (this.insertedAuthors || "").trim()
		) {
			this.insertedAuthors = "";
			newState.newPostText = "";
		}

		this.setState(newState);
	};

	// figure out who to at-mention based on the git blame data.
	// insert the text into the compose field
	addBlameAtMention(selectionRange, gitData) {
		let postText = this.state.newPostText || "";
		var authors = {};
		for (var lineNum = selectionRange.start.row; lineNum <= selectionRange.end.row; lineNum++) {
			var lineData = gitData[lineNum - 1];
			if (lineData) {
				const authorEmail = lineData["email"];
				if (authorEmail && authorEmail !== "not.committed.yet") {
					// find the author -- FIXME this feels fragile
					Object.entries(this.props.users).forEach(([userId, user]) => {
						if (user.email === authorEmail) {
							if (userId !== this.props.currentUser.id) {
								// skip if the input field already contains this user
								if (postText.match("@" + user.username + "\\b")) return;
								authors["@" + user.username] = true;
								this.setState(state => ({
									autoMentioning: [...state.autoMentioning, `@${user.username}`]
								}));
							}
						}
					});
				}
			}
		}

		if (Object.keys(authors).length > 0) {
			// the reason for this unicode space is that chrome will
			// not render a space at the end of a contenteditable div
			// unless it is a &nbsp;, which is difficult to insert
			// so we insert this unicode character instead
			var newText = Object.keys(authors).join(", ") + ":\u00A0";
			this.insertedAuthors = newText;
			this.insertTextAtCursor(newText);
		}
	}

	// configure the compose field in preparation for a comment on a codeBlock
	// this is what happens when someone clicks the floating (+) popup
	handleClickAddComment = () => {
		let editor = atom.workspace.getActiveTextEditor();
		if (!editor) return;

		trimSelection(editor);
		var range = editor.getSelectedBufferRange();
		let code = editor.getSelectedText();
		// preContext is the 10 lines of code immediately preceeding the selection
		let preContext = editor.getTextInBufferRange([
			[range.start.row - 10, 0],
			[range.start.row, range.start.column]
		]);
		// postContext is the 10 lines of code immediately following the selection
		let postContext = editor.getTextInBufferRange([
			[range.end.row, range.end.column],
			[range.end.row + 10, 0]
		]);

		// if there is no selected text, i.e. it is a 0-width range,
		// then grab the current line of code that the cursor is on
		if (code.length == 0 && range.start.row == range.end.row) {
			let lineRange = [[range.start.row, 0], [range.start.row, 10000]];
			code = editor.getTextInBufferRange(lineRange);
		}

		// not very React-ish but not sure how to set focus otherwise
		this.focusInput();

		let filePath = editor.getPath();
		const directory = atom.project.getDirectories().find(directory => directory.contains(filePath));
		if (directory) {
			atom.project.repositoryForDirectory(directory).then(projectRepo => {
				if (projectRepo) {
					if (!(projectRepo.path in this.projectBlamers)) {
						this.projectBlamers[projectRepo.path] = new Blamer(projectRepo);
					}
					const blamer = this.projectBlamers[projectRepo.path];

					if (blamer) {
						blamer.blame(filePath, (err, data) => {
							if (!err) this.addBlameAtMention(range, data);
						});
					}
				}
			});
		}

		this.setState({
			quoteRange: range,
			quoteText: code,
			preContext: preContext,
			postContext: postContext
		});
	};

	// when the input field loses focus, one thing we want to do is
	// to hide the at-mention popup
	handleOnBlur = async event => {
		this.setState({
			atMentionsOn: false
		});
	};

	// depending on the contents of the input field, if the user
	// types a "@" then open the at-mention popup
	handleOnChange = async event => {
		var newPostText = event.target.value;

		let selection = window.getSelection();
		let range = selection.getRangeAt(0);
		let node = range.commonAncestorContainer;
		let nodeText = node.textContent || "";
		let upToCursor = nodeText.substring(0, range.startOffset);
		var match = upToCursor.match(/@([a-zA-Z_.+]*)$/);
		if (this.state.atMentionsOn) {
			if (match) {
				var text = match[0].replace(/@/, "");
				this.showAtMentionSelectors(text);
			} else {
				// if the line doesn't end with @word, then hide the popup
				this.setState({ atMentionsOn: false });
			}
		} else {
			if (match) {
				var text = match[0].replace(/@/, "");
				this.showAtMentionSelectors(text);
			}
		}
		// track newPostText as the user types
		this.setState({ newPostText: newPostText });
	};

	handleOnKeyPress = event => {
		var newPostText = this.state.newPostText;

		// if we have the at-mentions popup open, then the keys
		// do something different than if we have the focus in
		// the textarea
		if (this.state.atMentionsOn) {
			if (event.key == "Escape") {
				this.hideAtMentionSelectors();
			} else if (event.key == "Enter" && !event.shiftKey) {
				event.preventDefault();
				this.selectFirstAtMention();
			} else {
				var match = newPostText.match(/@([a-zA-Z]*)$/);
				var text = match ? match[0].replace(/@/, "") : "";
				// this.showAtMentionSelectors(text);
			}
		} else if (event.key === "@") {
			this.showAtMentionSelectors("");
		} else if (event.key === "Escape") {
			this.slideThreadOut();
		} else if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			if (newPostText.trim().length > 0 && this.props.isOnline) {
				this.submitPost(newPostText);
			} else {
				// don't submit blank posts
			}
		}
	};

	selectFirstAtMention() {
		this.handleSelectAtMention();
	}

	// set up the parameters to pass to the at mention popup
	showAtMentionSelectors(prefix) {
		let peopleToShow = [];

		Object.keys(this.props.users).forEach(personId => {
			if (personId === this.props.currentUser.id) return;
			let person = this.props.users[personId];
			let toMatch = person.firstName + " " + person.lastName + "*" + person.username; // + "*" + person.email;
			let lowered = toMatch.toLowerCase();
			if (lowered.indexOf(prefix) !== -1) {
				peopleToShow.push(person);
			}
		});

		if (peopleToShow.length == 0) {
			this.setState({
				atMentionsOn: false
			});
		} else {
			let selected = peopleToShow[0].id;

			this.setState({
				atMentionsOn: true,
				atMentionsPrefix: prefix,
				atMentionsPeople: peopleToShow,
				atMentionsIndex: 0,
				selectedAtMention: selected
			});
		}
	}

	// the keypress handler for tracking up and down arrow
	// and enter, while the at mention popup is open
	handleAtMentionKeyPress(event, eventType) {
		if (eventType == "escape") {
			if (this.state.atMentionsOn) this.setState({ atMentionsOn: false });
			else this.setState({ threadActive: false });
		} else {
			let newIndex = 0;
			if (eventType == "down") {
				if (this.state.atMentionsIndex < this.state.atMentionsPeople.length - 1) {
					newIndex = this.state.atMentionsIndex + 1;
				} else {
					newIndex = 0;
				}
			} else if (eventType == "up") {
				if (this.state.atMentionsIndex == 0) {
					newIndex = this.state.atMentionsPeople.length - 1;
				} else {
					newIndex = this.state.atMentionsIndex - 1;
				}
			} else if (eventType == "tab") {
				this.selectFirstAtMention();
			}
			this.setState({
				atMentionsIndex: newIndex,
				selectedAtMention: this.state.atMentionsPeople[newIndex].id
			});
		}
	}

	// close the at mention popup when the customer types ESC
	handleEscape(event) {
		logger.trace(".handleEscape");
		if (this.state.editingPostId) this.setState({ editingPostId: null });
		else if (this.state.atMentionsOn) this.setState({ atMentionsOn: false });
		else if (this.state.threadActive) this.setState({ threadActive: null });
		else event.abortKeyBinding();
	}

	// when the user hovers over an at-mention list item, change the
	// state to represent a hovered state
	handleHoverAtMention = id => {
		let index = this.state.atMentionsPeople.findIndex(x => x.id == id);

		this.setState({
			atMentionsIndex: index,
			selectedAtMention: id
		});
	};

	handleSelectAtMention = id => {
		// if no id is passed, we assume that we're selecting
		// the currently-selected at mention
		if (!id) {
			id = this.state.selectedAtMention;
		}

		let user = this.props.users[id];
		if (!user) return;
		let username = user.username;
		// otherwise explicitly use the one passed in
		// FIXME -- this should anchor at the carat, not end-of-line
		var re = new RegExp("@" + this.state.atMentionsPrefix + "$");
		// var re = new RegExp("@" + this.state.atMentionsPrefix);
		let text = this.state.newPostText.replace(re, "@" + username);
		this.setState({
			atMentionsOn: false
		});
		// the reason for this unicode space is that chrome will
		// not render a space at the end of a contenteditable div
		// unless it is a &nbsp;, which is difficult to insert
		// so we insert this unicode character instead
		let toInsert = username + "\u00A0";
		let that = this;
		setTimeout(function() {
			that.focusInput();
		}, 20);
		this.insertTextAtCursor(toInsert, this.state.atMentionsPrefix);
		// this.setNewPostText(text);
	};

	// insert the given text at the cursor of the input field
	// after first deleting the text in toDelete
	insertTextAtCursor(text, toDelete) {
		var sel, range, html;
		sel = window.getSelection();

		// if for some crazy reason we can't find a selection, return
		// to avoid an error.
		// https://stackoverflow.com/questions/22935320/uncaught-indexsizeerror-failed-to-execute-getrangeat-on-selection-0-is-not
		if (sel.rangeCount == 0) return;

		range = sel.getRangeAt(0);

		// delete the X characters before the caret
		range.setStart(range.commonAncestorContainer, range.startOffset - (toDelete || "").length);
		// range.moveEnd("character", toDelete.length);

		range.deleteContents();
		var textNode = document.createTextNode(text);
		range.insertNode(textNode);
		range.setStartAfter(textNode);
		sel.removeAllRanges();
		sel.addRange(range);
		this._contentEditable.htmlEl.normalize();

		this.setState({ newPostText: this._contentEditable.htmlEl.innerHTML });
	}

	// create a new post
	submitPost(newText) {
		// convert the text to plaintext so there is no HTML
		newText = newText.replace(/<br>/g, "\n");
		const doc = new DOMParser().parseFromString(newText, "text/html");
		newText = doc.documentElement.textContent;

		const codeBlocks = [];
		const { quoteText, quoteRange, preContext, postContext, threadActive } = this.state;
		const { id, createPost } = this.props;

		let threadId = threadActive ? this.state.threadId : null;

		if (quoteText) {
			codeBlocks.push({
				code: quoteText,
				location: rangeToLocation(quoteRange),
				preContext,
				postContext,
				// for now, we assume this codeblock came from this buffer
				// in the future we want to support commenting on codeBlocks
				// from other files/buffers
				streamId: id
			});
		}

		const mentionUserIds = this.findMentions(newText);
		const editor = atom.workspace.getActiveTextEditor();
		const editorText = editor.getText();

		createPost(this.props.id, threadId, newText, codeBlocks, mentionUserIds, editorText, {
			autoMentions: this.state.autoMentioning
		});

		// reset the input field to blank
		this.resetCompose();
	}

	// if we receive newState as an argument, set the compose state
	// to that state. otherwise reset it (clear it out)
	resetCompose(newState) {
		this.insertedAuthors = "";
		if (newState) {
			this.setState(newState);
		} else {
			this.setState({
				newPostText: "",
				quoteRange: null,
				quoteText: "",
				preContext: "",
				postContext: "",
				autoMentioning: []
			});
			this.savedComposeState[this.id] = {};
		}
	}
}

const getLocationsByPost = (locationsByCommit = {}, commitHash, markers) => {
	const locations = locationsByCommit[commitHash] || {};
	const locationsByPost = {};
	Object.keys(locations).forEach(markerId => {
		const marker = markers[markerId];
		if (marker) {
			locationsByPost[marker.postId] = locations[markerId];
		}
	});
	return locationsByPost;
};

const getMarkersForStreamAndCommit = (locationsByCommit = {}, commitHash, markers) => {
	const locations = locationsByCommit[commitHash] || {};
	return Object.keys(locations)
		.map(markerId => {
			const marker = markers[markerId];
			if (marker) {
				return {
					...marker,
					location: locations[markerId]
				};
			} else {
				const message = `No marker for id ${markerId} but there are locations for it. commitHash: ${commitHash}`;
				Raven.captureMessage(message, {
					logger: "Stream::mapStateToProps::getMarkersForStreamAndCommit",
					extra: {
						location: locations[markerId]
					}
				});
				console.warn(message);
				return false;
			}
		})
		.filter(Boolean);
};

const mapStateToProps = ({
	connectivity,
	session,
	context,
	streams,
	users,
	posts,
	markers,
	markerLocations,
	messaging,
	onboarding
}) => {
	const stream = getStreamForRepoAndFile(streams, context.currentRepoId, context.currentFile) || {};
	const markersForStreamAndCommit = getMarkersForStreamAndCommit(
		markerLocations.byStream[stream.id],
		context.currentCommit,
		markers
	);
	const locations = getLocationsByPost(
		markerLocations.byStream[stream.id],
		context.currentCommit,
		toMapBy("id", markersForStreamAndCommit)
	);

	Object.keys(users).forEach(function(key, index) {
		users[key].color = index % 10;
		if (!users[key].username) {
			let email = users[key].email;
			if (email) users[key].username = email.replace(/@.*/, "");
		}
	});

	const teamMembers = _.filter(users, user => (user.teamIds || []).includes(context.currentTeamId));

	// this usenames regexp is a pipe-separated list of
	// either usernames or if no username exists for the
	// user then his email address. it is sorted by length
	// so that the longest possible match will be made.
	const usernamesRegexp = Object.keys(teamMembers)
		.map(key => {
			return teamMembers[key].username || "";
		})
		.sort(function(a, b) {
			return b.length - a.length;
		})
		.join("|")
		.replace(/\|\|+/g, "|") // remove blank identifiers
		.replace(/\+/g, "\\+") // replace + and . with escaped versions so
		.replace(/\./g, "\\."); // that the regexp matches the literal chars

	const isOnline =
		!connectivity.offline && messaging.failedSubscriptions.length === 0 && !messaging.timedOut;
	return {
		isOnline,
		id: stream.id,
		teamId: stream.teamId,
		firstTimeInAtom: onboarding.firstTimeInAtom,
		currentFile: context.currentFile,
		currentCommit: context.currentCommit,
		markers: markersForStreamAndCommit,
		users: toMapBy("id", teamMembers),
		editingUsers: stream.editingUsers,
		usernamesRegexp: usernamesRegexp,
		currentUser: users[session.userId],
		posts: getPostsForStream(posts, stream.id || context.currentFile).map(post => {
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
				markerLocation: locations[post.id],
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
