import { shell } from "electron";
import { CompositeDisposable } from "atom";
import React, { Component } from "react";
import { connect } from "react-redux";
import ContentEditable from "react-contenteditable";
import { FormattedMessage } from "react-intl";
import _ from "underscore-plus";
import Post from "./Post";
import UMIs from "./UMIs";
import AtMentionsPopup from "./AtMentionsPopup";
import BufferReferences from "./BufferReferences";
import AddCommentPopup from "./AddCommentPopup";
import createClassString from "classnames";
import DateSeparator from "./DateSeparator";
var Blamer = require("../util/blamer");
import * as streamActions from "../actions/stream";
import { createPost, fetchPosts } from "../actions/post";
import { toMapBy } from "../reducers/utils";
import rootLogger from "../util/Logger";

const logger = rootLogger.forClass("components/Stream");

export class SimpleStream extends Component {
	subscriptions = null;

	constructor(props) {
		super(props);

		// FIXME -- this stuff shouldn't be stored here
		this.projectBlamers = {};
		this.blameData = {};
		// end FIXME

		this.state = {
			stream: {},
			threadId: null,
			posts: [],
			fileForIntro: this.props.currentFile
		};

		this.savedComposeState = {};

		this.subscriptions = new CompositeDisposable();
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
				"codestream:escape": event => this.handleEscape(event)
			})
		);
		this.subscriptions.add(
			atom.commands.add("atom-workspace", {
				"codestream:add-dummy-post": event => this.addDummyPost(),
				"codestream:comment": event => this.handleClickAddComment(),
				"codestream:focus-input": event => this.toggleFocusInput()
			})
		);
	}

	componentDidMount() {
		logger.trace(".componentDidMount");
		this.props.recalculateUMI(); // set the UMI for the first time
		// TODO: scroll to bottom

		let inputDiv = document.querySelector('div[contenteditable="true"]');
		if (!inputDiv) return;

		// this listener pays attention to when the input field resizes,
		// presumably because the user has typed more than one line of text
		// in it, and calls a function to handle the new size
		new ResizeObserver(this.handleResizeCompose).observe(this._compose);

		// so that HTML doesn't get pasted into the input field. without this,
		// HTML would be rendered as HTML when pasted
		inputDiv.addEventListener("paste", function(e) {
			e.preventDefault();
			var text = e.clipboardData.getData("text/plain");
			document.execCommand("insertHTML", false, text);
		});
	}

	componentWillReceiveProps(nextProps) {
		logger.trace(".componentWillReceiveProps");
		const switchingStreams = nextProps.id !== this.props.id;
		if (nextProps.id && switchingStreams && nextProps.posts.length === 0)
			this.props.fetchPosts({ streamId: nextProps.id, teamId: nextProps.teamId });
		if (switchingStreams) {
			this.saveComposeState(nextProps.id);
			this.handleDismissThread();

			// keep track of the new message indicator in "this" instead of looking
			// directly at currentUser.lastReads, because that will change and trigger
			// a re-render, which would remove the "new messages" line
			this.postWithNewMessageIndicator = null;
			if (this.props.currentUser && this.props.currentUser.lastReads) {
				this.postWithNewMessageIndicator = this.props.currentUser.lastReads[nextProps.id];
			}
		}

		new AddCommentPopup({ handleClickAddComment: this.handleClickAddComment });
	}

	componentDidUpdate(prevProps, prevState) {
		logger.trace(".componentDidUpdate");
		this._postslist.scrollTop = 100000;
		this.installEditorHandlers();

		// if we just switched to a new stream, mark the
		// stream as read
		if (this.props.id !== prevProps.id) {
			// FIXME -- is this the right place to call mark read?
			this.props.markStreamRead(this.props.id);
			this.resizeStream();
		}
	}

	installSelectionHandler() {
		logger.trace(".installSelectionHandler");
		// if (this.selectionHandler) return;
		let editor = atom.workspace.getActiveTextEditor();
		this.selectionHandler = editor.onDidChangeSelectionRange(this.destroyCodeBlockMarker);
	}

	destroyCodeBlockMarker = () => {
		logger.trace(".destroyCodeBlockMarker");
		if (this.codeBlockMarker) this.codeBlockMarker.destroy();
		if (this.selectionHandler) this.selectionHandler.dispose();
	};

	installEditorHandlers() {
		logger.trace(".installEditorHandlers");
		let editor = atom.workspace.getActiveTextEditor();
		// console.log(editor);
		if (editor && !editor.hasCodeStreamHandlers) {
			let scrollViewDiv = editor.component.element.querySelector(".scroll-view");
			if (scrollViewDiv) {
				// console.log("INSTALLING RESIZE OBSERVER 2");
				let that = this;
				new ResizeObserver(function() {
					that.handleResizeWindow(scrollViewDiv);
				}).observe(scrollViewDiv);
				// that.handleResizeWindow();
				editor.hasCodeStreamHandlers = true;
			}
		}
	}

	handleResizeCompose = () => {
		logger.trace(".handleResizeCompose");
		// console.log("COMPOSE RESIZE");
		this.resizeStream();
	};

	handleResizeWindow = scrollViewDiv => {
		logger.trace(".handleResizeWindow");
		// if the div has display: none then there will be no width
		if (!scrollViewDiv || !scrollViewDiv.offsetWidth) return;

		let rect = scrollViewDiv.getBoundingClientRect();
		// FIXME -- if there is panel is on the right, then subtract 20 more
		let width = scrollViewDiv.offsetWidth + rect.left;
		let newStyle = ".codestream-comment-popup { left: " + width + "px; }";
		// console.log("Adding style string; " + newStyle);
		this.addStyleString(newStyle);
	};

	// add a style to the document, reusing a style node that we attach to the DOM
	addStyleString(str) {
		logger.trace(".addStyleString");
		let node = document.getElementById("codestream-style-tag") || document.createElement("style");
		node.id = "codestream-style-tag";
		node.innerHTML = str;
		document.body.appendChild(node);
	}

	handleNewPost = () => {};

	addDummyPost = () => {
		logger.trace(".addDummyPost");
		this.props.createPost(
			this.props.id,
			this.state.threadId,
			"perhaps. blame isn't part of git-plus so I can't think of anything that stands out yet. there is a git-blame package that users wanted to see merged into git-plus. maybe there's some insight there"
		);
	};

	resizeStream = () => {
		logger.trace(".resizeStream");
		if (!this._div) return;
		const streamHeight = this._div.offsetHeight;
		const postslistHeight = this._postslist.offsetHeight;
		if (postslistHeight < streamHeight) {
			let newHeight =
				streamHeight - postslistHeight + this._intro.offsetHeight - this._compose.offsetHeight;
			this._intro.style.height = newHeight + "px";
		}
		if (this._compose) this._div.style.paddingBottom = this._compose.offsetHeight + "px";
		// if (this._atMentionsPopup)
		// this._atMentionsPopup.style.bottom = this._compose.offsetHeight + "px";
		this._postslist.scrollTop = 100000;
	};

	// return the post, if any, with the given ID
	findPostById(id) {
		logger.trace(".findPostById", id);
		return this.props.posts.find(post => id === post.id);
	}

	// return a simple identifying string to represent the current path.
	// example is /path/to/foo.bar would just return "foo.bar"
	// FIXME -- this should be improved for systems that don't use "/"
	// as a path delimiter
	fileAbbreviation() {
		logger.trace(".fileAbbreviation");
		if (!this.props.currentFile) return "";
		return this.props.currentFile.replace(/.*\//g, "");
	}

	renderIntro = () => {
		logger.trace(".renderIntro");
		if (this.props.firstTimeInAtom && this.props.currentFile === this.state.fileForIntro) {
			return [
				<label>
					<FormattedMessage id="stream.intro.welcome" defaultMessage="Welcome to CodeStream!" />
				</label>,
				<label>
					<ul>
						<li>
							<FormattedMessage
								id="stream.intro.eachFile"
								defaultMessage="Every source file has its own conversation stream. Just pick a file, post a message, and any of your teammates can contribute to the conversation."
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
								defaultMessage="Share your wisdom by clicking on any post in the stream and adding a reply."
							/>
						</li>
					</ul>
				</label>,
				<label>
					Learn more at{" "}
					<a onClick={e => shell.openExternal("https://help.codestream.com")}>
						help.codestream.com
					</a>.
				</label>
			];
		}
		return (
			<label>
				This is the start of your discussion about <b>{this.fileAbbreviation()}</b>.
			</label>
		);
	};

	// we render both a main stream (postslist) plus also a postslist related
	// to the currently selected thread (if it exists). the reason for this is
	// to be able to animate between the two streams, since they will both be
	// visible during the transition
	render() {
		logger.trace(".render");
		const posts = this.props.posts;
		// console.log("rendering posts", posts);

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
			inactive: this.state.threadId
		});
		const threadPostsListClass = createClassString({
			postslist: true,
			threadlist: true,
			inactive: !this.state.threadId
		});

		let newPostText = this.state.newPostText || "";

		let usernames = Object.keys(this.props.users)
			.map(key => {
				return this.props.users[key].username;
			})
			.join("|")
			.replace(/\|\|+/g, "|");
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
		let placeholderText = "Message " + fileAbbreviation;
		// FIXME -- this doesn't update when it should for some reason
		if (threadPost) {
			placeholderText = "Reply to " + threadPost.author.username;
		}

		return (
			<div className={streamClass} ref={ref => (this._div = ref)}>
				<UMIs />
				<BufferReferences
					streamId={this.props.id}
					references={this.props.markers}
					onSelect={this.selectPost}
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
						// this needs to be done by storing the return value of the render,
						// then setting lastTimestamp, otherwise you wouldn't be able to
						// compare the current one to the prior one.
						const parentPost = posts.find(p => p.id === post.parentPostId);
						const returnValue = (
							<div key={post.id}>
								<DateSeparator timestamp1={lastTimestamp} timestamp2={post.createdAt} />
								<Post
									post={post}
									usernames={usernames}
									currentUsername={this.props.currentUser.username}
									replyingTo={parentPost}
									newMessageIndicator={post.id === this.postWithNewMessageIndicator}
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
					<div id="close-thread" onClick={this.handleDismissThread}>
						&larr; Back to stream
					</div>
					{threadPost && (
						<Post
							post={threadPost}
							usernames={usernames}
							currentUsername={this.props.currentUser.username}
							key={threadPost.id}
							showDetails="1"
							currentCommit={this.props.currentCommit}
						/>
					)}
					{
						(lastTimestamp =
							0 ||
							posts.map(post => {
								if (threadId && threadId != post.parentPostId) {
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
											usernames={usernames}
											currentUsername={this.props.currentUser.username}
											showDetails="1"
											currentCommit={this.props.currentCommit}
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
					prefix={this.state.atMentionsPrefix}
					selected={this.state.selectedAtMention}
					handleHoverAtMention={this.handleHoverAtMention}
					handleSelectAtMention={this.handleSelectAtMention}
				/>
				<div
					className={composeClass}
					onKeyPress={this.handleOnKeyPress}
					ref={ref => (this._compose = ref)}
				>
					{hasNewMessagesBelowFold && (
						<div className="new-messages-below" onClick={this.handleClickScrollToNewMessages}>
							&darr; Unread Messages &darr;
						</div>
					)}
					{quoteInfo}
					{quoteHint}
					<ContentEditable
						className="native-key-bindings"
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
			</div>
		);
	}

	// turn a codestream flat-array range into the format that atom understands
	makeRange(location) {
		logger.trace(".makeRange");
		return [[location[0], location[1]], [location[2], location[3]]];
	}

	makeLocation(headPosition, tailPosition) {
		logger.trace(".makeLocation", headPosition, tailPosition);
		const location = [];
		location[0] = tailPosition.row;
		location[1] = tailPosition.column;
		location[2] = headPosition.row;
		location[3] = headPosition.column;
		return location;
	}

	// comment markers are the annotation indicators that appear in the right
	// margin between the buffer and the codestream pane
	// this is only partially implemented, as it's very fragile as-is
	// improvement pending discussion with the team
	renderCommentMarkers = () => {
		logger.trace(".renderCommentMarkers");
		let that = this;
		let editor = atom.workspace.getActiveTextEditor();
		if (!editor) return;
		if (!this.props.markers) return;
		if (editor.hasCodeStreamMarkersRendered) return;
		editor.hasCodeStreamMarkersRendered = true;
		// console.log(this.props.markers);
		// console.log("Rendering these markers: " + this.props.markers.length);

		// loop through and get starting line for each marker,
		// to detect when we have overlaps with an O(N) algorithm
		let markersByLine = {};
		this.props.markers.forEach(codeMarker => {
			let line = codeMarker.location[0];
			if (!markersByLine[line]) markersByLine[line] = [];
			markersByLine[line].push(codeMarker);

			const location = codeMarker.location;
			const range = that.makeRange(location);
			const displayMarker = editor.markBufferRange(range, { invalidate: "touch" });

			displayMarker.onDidChange(event => {
				const post = that.findPostById(codeMarker.postId);
				post.markerLocation = codeMarker.location = that.makeLocation(
					event.newHeadBufferPosition,
					event.newTailBufferPosition
				);
				// TODO update it locally
			});
		});

		for (var line in markersByLine) {
			let codeMarkers = markersByLine[line];
			let numComments = 0;
			let maxLine = line * 1;

			let item = document.createElement("div");
			item.className = "codestream-comment-popup";
			codeMarkers.forEach(function(codeMarker, index) {
				console.log("Adding num comments: " + codeMarker.numComments);
				numComments += codeMarker.numComments;

				let bubble = document.createElement("div");
				// we add a "count" class which is the reverse of the index
				// so that bubbles lower in the stacking order can be offset
				// by a few pixels giving a "stacked bubbles" effect in CSS
				bubble.classList.add("count-" + (codeMarkers.length - index - 1));
				bubble.onclick = function() {
					that.selectPost(codeMarker.postId);
				};
				bubble.innerText = codeMarker.numComments > 9 ? "9+" : codeMarker.numComments;
				item.appendChild(bubble);
				if (codeMarker.location[2] > maxLine) maxLine = codeMarker.location[2] * 1;
			});
			// item.innerText = numComments > 9 ? "9+" : numComments;

			console.log("RANGE IS: " + line + " - " + maxLine);
			var range = [[line * 1, 0], [maxLine + 1, 0]];
			var marker = editor.markBufferRange(range, { invalidate: "never" });
			marker.onDidChange(function(event) {
				console.log("in the ondidchange");
				console.log("This is where we should update the markers because they ahve moved");
				if (event.textChanged) that.checkMarkerDiff(codeMarkers);
			});

			editor.decorateMarker(marker, {
				type: "overlay",
				item: item,
				position: "tail",
				class: "codestream-overlay"
			});
			if (numComments === 1) this.tooltip = atom.tooltips.add(item, { title: "View comment" });
			else this.tooltip = atom.tooltips.add(item, { title: "View " + numComments + " comments" });
		}

		// this.props.markers.forEach(codeMarker => {
		// 	// console.log("Rendering a marker: ", codeMarker);
		// 	let location = codeMarker.location;
		// 	let line = location[0];
		// 	var range = [[line, 0], [line, 0]];
		// 	var marker = editor.markBufferRange(range, { invalidate: "never" });
		// 	// marker.setProperties({ codestreamStreamId: streamId });
		//
		// 	let numComments = codeMarker.numComments > 9 ? "9+" : codeMarker.numComments;
		// 	let item = document.createElement("div");
		// 	item.innerText = numComments;
		// 	item.className = "codestream-comment-popup";
		//
		// 	// adding a class with the count of the # of markers on this line
		// 	// allows us to control the position of the 2nd, 3rd, 4th
		// 	// overlapping marker (see codestream.less for specifics)
		// 	let countOnLine = markersByLine[location[0]].indexOf(codeMarker.id);
		// 	console.log("COL is: " + countOnLine);
		// 	item.classList.add("count-" + countOnLine);
		//
		// 	item.onclick = function() {
		// 		that.selectPost(codeMarker.postId);
		// 	};
		// 	item.onmouseenter = function() {
		// 		that.mouseEnter(codeMarker.postId, line, countOnLine);
		// 	};
		// 	item.onmouseleave = function() {
		// 		that.mouseLeave(codeMarker.postId, line, countOnLine);
		// 	};
		// 	editor.decorateMarker(marker, { type: "overlay", item: item, class: "codestream-overlay" });
		// 	this.tooltip = atom.tooltips.add(item, { title: "View comments" });
		// });
	};

	checkMarkerDiff = codeMarkers => {
		logger.trace(".checkMarkerDiff");
		console.log("Checking diffs for markers");
		console.log(codeMarkers);
	};

	saveComposeState(nextId) {
		logger.trace(".saveComposeState");
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
	handleDismissThread = () => {
		logger.trace(".handleDismissThread");
		this.destroyCodeBlockMarker();
		this.setState({ threadId: null });
	};

	// by clicking on the post, we select it
	handleClickPost = event => {
		logger.trace(".handleClickPost");
		var postDiv = event.target.closest(".post");
		if (!postDiv) return;
		this.selectPost(postDiv.id);
	};

	// show the thread related to the given post, and if there is
	// a codeblock, scroll to it and select it
	selectPost = id => {
		logger.trace(".selectPost");
		let post = this.findPostById(id);
		if (!post) return;

		// if it is a child in the thread, it'll have a parentPostId,
		// otherwise use the id. any post can become the head of a thread
		let threadId = post.parentPostId || post.id;
		this.setState({ threadId: threadId });

		if (post.codeBlocks && post.codeBlocks.length) {
			let codeBlock = post.codeBlocks[0];
			let location = post.markerLocation;
			if (location) {
				let markerRange = this.makeRange(location);
				// FIXME -- switch to stream if code is from another buffer
				const editor = atom.workspace.getActiveTextEditor();
				if (this.codeBlockMarker) this.codeBlockMarker.destroy();
				this.codeBlockMarker = editor.markBufferRange(markerRange, { invalidate: "touch" });
				editor.decorateMarker(this.codeBlockMarker, {
					type: "highlight",
					class: "codestream-highlight"
				});

				var start = [location[0], location[1]];
				editor.setCursorBufferPosition(start);
				editor.scrollToBufferPosition(start, {
					center: true
				});

				this.installSelectionHandler();
			}
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
		// console.log("SETTING TEXT TO: >" + text + "<");
		// console.log(this._contentEditable);
		// this._contentEditable.htmlEl.innerHTML = text;
		this.setState({ newPostText: text });
	}

	// toggle focus between the buffer and the compose input field
	toggleFocusInput = () => {
		logger.trace(".toggleFocusInput");
		if (document.activeElement && document.activeElement.id == "input-div")
			atom.workspace.getCenter().activate();
		else this.focusInput();
	};

	focusInput = () => {
		logger.trace(".focusInput");
		document.getElementById("input-div").focus();
	};

	handleClickScrollToNewMessages = () => {
		logger.trace(".handleClickScrollToNewMessages");
		// console.log("CLICKED SCROLL DOWN");
		this._postslist.scrollTop = 100000;
	};

	handleClickDismissQuote = () => {
		logger.trace(".handleClickDismissQuote");
		// not very React-ish but not sure how to set focus otherwise
		this.focusInput();

		let newState = {
			quoteText: "",
			preContext: "",
			postContext: "",
			quoteRange: null
		};

		// remove any at-mentions that we have added manually
		if (this.state.newPostText.replace(/&nbsp;/g, " ").trim() === this.insertedAuthors.trim()) {
			this.insertedAuthors = "";
			newState.newPostText = "";
		}

		this.setState(newState);
	};

	// figure out who to at-mention based on the git blame data.
	// insert the text into the compose field
	addBlameAtMention(selectionRange, gitData) {
		logger.trace(".addBlameAtMention");
		// console.log(data);
		let postText = this.state.newPostText || "";
		var authors = {};
		for (var lineNum = selectionRange.start.row; lineNum <= selectionRange.end.row; lineNum++) {
			var lineData = gitData[lineNum - 1];
			if (lineData) {
				var author = lineData["author"];
				if (author && author !== "Not Committed Yet") {
					// find the author -- FIXME this feels fragile
					Object.keys(this.props.users).forEach(personId => {
						let person = this.props.users[personId];
						let fullName = person.firstName + " " + person.lastName;
						if (fullName == author || person.username == author) {
							if (person.username !== this.props.currentUser.username) {
								// skip if the input field already contains this user
								if (postText.match("@" + person.username + "\\b")) return;
								authors["@" + person.username] = true;
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
		logger.trace(".handleClickAddComment");
		let editor = atom.workspace.getActiveTextEditor();
		if (!editor) return;

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

		var that = this;
		let filePath = editor.getPath();
		const directory = atom.project.getDirectories().find(directory => directory.contains(filePath));
		atom.project.repositoryForDirectory(directory).then(function(projectRepo) {
			// Ensure this project is backed by a git repository
			if (!projectRepo) {
				errorController.showError("error-not-backed-by-git");
				return;
			}

			if (!(projectRepo.path in that.projectBlamers)) {
				that.projectBlamers[projectRepo.path] = new Blamer(projectRepo);
			}
			// BlameViewController.toggleBlame(this.projectBlamers[projectRepo.path]);
			var blamer = that.projectBlamers[projectRepo.path];

			if (!that.blameData[filePath]) {
				// console.log(blamer);
				blamer.blame(filePath, function(err, data) {
					that.blameData[filePath] = data;
					that.addBlameAtMention(range, data);
				});
			} else {
				that.addBlameAtMention(range, that.blameData[filePath]);
			}
		});

		// not very React-ish but not sure how to set focus otherwise
		this.focusInput();

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
		logger.trace(".handleOnBlur");
		this.setState({
			atMentionsOn: false
		});
	};

	// depending on the contents of the input field, if the user
	// types a "@" then open the at-mention popup
	handleOnChange = async event => {
		logger.trace(".handleOnChange");
		var newPostText = event.target.value;

		let selection = window.getSelection();
		let range = selection.getRangeAt(0);
		let upToCursor = newPostText.substring(0, range.startOffset);
		// console.log("UTC: >" + upToCursor + "<");
		var match = upToCursor.match(/@([a-zA-Z]*)$/);
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

	handleOnKeyPress = async event => {
		logger.trace(".handleOnKeyPress");
		var newPostText = this.state.newPostText;

		// console.log("ON KEYPRESS: " + event.key);
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
		} else if (event.key == "@") {
			this.showAtMentionSelectors("");
		} else if (event.key == "Escape") {
			this.slideThreadOut();
		} else if (event.key == "Enter" && !event.shiftKey) {
			event.preventDefault();
			if (newPostText.length > 0) {
				this.submitPost(newPostText);
			} else {
				// don't submit blank posts
			}
		}
	};

	selectFirstAtMention() {
		logger.trace(".selectFirstAtMention");
		this.handleSelectAtMention();
	}

	// set up the parameters to pass to the at mention popup
	showAtMentionSelectors(prefix) {
		logger.trace(".showAtMentionSelectors");
		let peopleToShow = [];

		Object.keys(this.props.users).forEach(personId => {
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
		logger.trace(".handleAtMentionKeyPress", event, eventType);
		// console.log("AT MENTION KEY PRESS: " + eventType);
		if (eventType == "escape") {
			if (this.state.atMentionsOn) this.setState({ atMentionsOn: false });
			else this.setState({ threadId: null });
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
		if (this.state.atMentionsOn) this.setState({ atMentionsOn: false });
		else if (this.state.threadId) this.setState({ threadId: null });
		else event.abortKeyBinding();
	}

	// when the user hovers over an at-mention list item, change the
	// state to represent a hovered state
	handleHoverAtMention = id => {
		logger.trace(".handleHoverAtMention");
		let index = this.state.atMentionsPeople.findIndex(x => x.id == id);

		this.setState({
			atMentionsIndex: index,
			selectedAtMention: id
		});
	};

	handleSelectAtMention = id => {
		logger.trace(".handleSelectAtMention");
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
		logger.trace(".insertTextAtCursor");
		var sel, range, html;
		sel = window.getSelection();
		range = sel.getRangeAt(0);

		// delete the X characters before the caret
		range.setStart(range.commonAncestorContainer, range.startOffset - toDelete.length);
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
		logger.trace(".submitPost");
		newText = newText.replace(/<br>/g, "\n");

		// convert the text to plaintext so there is no HTML
		var doc = new DOMParser().parseFromString(newText, "text/html");
		newText = doc.documentElement.textContent;
		// console.log(this.state.quoteRange);
		let codeBlocks = [];
		if (this.state.quoteText) {
			let quoteRange = this.state.quoteRange;
			codeBlocks = [
				{
					code: this.state.quoteText,
					location: [
						quoteRange.start.row,
						quoteRange.start.column,
						quoteRange.end.row,
						quoteRange.end.column
					],
					preContext: this.state.preContext,
					postContext: this.state.postContext,
					// for now, we assume this codeblock came from this buffer
					// in the future we want to support commenting on codeBlocks
					// from other files/buffers
					streamId: this.props.id
				}
			];
		}

		this.props.createPost(this.props.id, this.state.threadId, newText, codeBlocks);

		// reset the input field to blank
		this.resetCompose();
	}

	// if we receive newState as an argument, set the compose state
	// to that state. otherwise reset it (clear it out)
	resetCompose(newState) {
		logger.trace(".resetCompose");
		this.insertedAuthors = "";
		if (newState) {
			this.setState(newState);
		} else {
			this.setState({
				newPostText: "",
				quoteRange: null,
				quoteText: "",
				preContext: "",
				postContext: ""
			});
			this.savedComposeState[this.id] = {};
		}
	}
}

const getPostsForStream = (streamId = "", { byStream }) => {
	logger.trace(".getPostsForStream");
	if (streamId === "") return [];
	return _.sortBy(byStream[streamId], "seqNum");
};

const getLocationsByPost = (locationsByCommit = {}, commitHash, markers) => {
	logger.trace(".getLocationsByPost");
	const locations = locationsByCommit[commitHash] || {};
	const locationsByPost = {};
	Object.keys(locations).forEach(markerId => {
		const marker = markers[markerId];
		locationsByPost[marker.postId] = locations[markerId];
	});
	return locationsByPost;
};

const getMarkersForStreamAndCommit = (locationsByCommit = {}, commitHash, markers) => {
	logger.trace(".getMarkersForStreamAndCommit");
	const locations = locationsByCommit[commitHash] || {};
	return Object.keys(locations).map(markerId => {
		const marker = markers[markerId];
		return {
			...marker,
			location: locations[markerId]
		};
	});
};

const mapStateToProps = ({
	session,
	context,
	streams,
	users,
	posts,
	markers,
	markerLocations,
	onboarding
}) => {
	logger.trace(".mapStateToProps");
	const stream = streams.byFile[context.currentFile] || {};
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

	const teamMembers = _.filter(
		users,
		user => (user.teamIds || []).includes(context.currentTeamId) && user.id !== session.userId
	);

	return {
		id: stream.id,
		teamId: stream.teamId,
		firstTimeInAtom: onboarding.firstTimeInAtom,
		currentFile: context.currentFile,
		currentCommit: context.currentCommit,
		markers: markersForStreamAndCommit,
		users: toMapBy("id", teamMembers),
		currentUser: users[session.userId],
		posts: getPostsForStream(stream.id, posts).map(post => {
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
			const { username, email, firstName, lastName, color } = user;
			return {
				...post,
				markerLocation: locations[post.id],
				author: { username, email, color, fullName: `${firstName} ${lastName}`.trim() }
			};
		})
	};
};

export default connect(mapStateToProps, { ...streamActions, fetchPosts, createPost })(SimpleStream);
