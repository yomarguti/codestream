import { CompositeDisposable } from "atom";
import React, { Component } from "react";
import { connect } from "react-redux";
import ContentEditable from "react-contenteditable";
import _ from "underscore-plus";
import Post from "./Post";
import PostDetails from "./PostDetails";
import AtMentionsPopup from "./AtMentionsPopup";
import AddCommentPopup from "./AddCommentPopup";
import createClassString from "classnames";
import DateSeparator from "./DateSeparator";
var Blamer = require("../util/blamer");
import * as actions from "../actions/stream";

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
			authors: [
				{ id: 1, nick: "pez", fullName: "Peter Pezaris", email: "pez@codestream.com" },
				{
					id: 2,
					nick: "marcelo",
					fullName: "Marcelo Bukowski de Farias",
					email: "marcelo@codestream.com"
				},
				{ id: 3, nick: "akonwi", fullName: "Akonwi Ngoh", email: "akonwi@codestream.com" },
				{ id: 4, nick: "jj", fullName: "James Price", email: "jj@codestream.com" },
				{ id: 5, nick: "colin", fullName: "Colin Stryker", email: "colin@codestream.com" }
			]
		};

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
			atom.commands.add(".codestream", {
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

	installSelectionHandler() {
		// if (this.selectionHandler) return;
		let editor = atom.workspace.getActiveTextEditor();
		this.selectionHandler = editor.onDidChangeSelectionRange(this.destroyCodeBlockMarker);
	}

	destroyCodeBlockMarker = () => {
		if (this.codeBlockMarker) this.codeBlockMarker.destroy();
		if (this.selectionHandler) this.selectionHandler.dispose();
	};

	componentWillReceiveProps(nextProps) {
		if (!nextProps.id) this.props.fetchStream();
		if (nextProps.id !== this.props.id) {
			this.handleDismissThread();
		}
		new AddCommentPopup({ handleClickAddComment: this.handleClickAddComment });
	}

	componentDidUpdate(prevProps, prevState) {
		this._postslist.scrollTop = 100000;
		this.installEditorHandlers();
	}

	installEditorHandlers() {
		let editor = atom.workspace.getActiveTextEditor();
		console.log(editor);
		if (editor && !editor.hasCodeStreamHandlers) {
			console.log("INSTALLING RESIZE OBSERVER");
			let scrollViewDiv = document.querySelector("atom-text-editor.is-focused .scroll-view");
			// console.log("SV IS: ", scrollViewDiv);
			if (scrollViewDiv) {
				// console.log("INSTALLING RESIZE OBSERVER 2");
				new ResizeObserver(this.handleResizeWindow).observe(scrollViewDiv);
				// that.handleResizeWindow();
				editor.hasCodeStreamHandlers = true;
			}
		}
	}

	componentDidMount() {
		this.props.fetchStream(); // Fetch any new stuff
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

	handleResizeCompose = () => {
		// console.log("COMPOSE RESIZE");
		this.resizeStream();
	};

	handleResizeWindow = () => {
		let scrollViewDiv = document.querySelector("atom-text-editor.is-focused .scroll-view");
		if (scrollViewDiv) {
			let width = scrollViewDiv.offsetWidth - 20;
			// FIXME -- if there is panel is on the right, then subtract 20 more
			let newStyle = ".codestream-comment-popup { left: " + width + "px; }";
			// console.log("Adding style string; " + newStyle);
			this.addStyleString(newStyle);
		} else {
			console.log("Couldn't find scroll view");
		}
	};

	// add a style to the document, reusing a style node that we attach to the DOM
	addStyleString(str) {
		let node = document.getElementById("codestream-style-tag") || document.createElement("style");
		node.id = "codestream-style-tag";
		node.innerHTML = str;
		document.body.appendChild(node);
	}

	handleNewPost = () => {};

	addDummyPost = () => {
		this.props.createPost(
			this.props.id,
			this.state.threadId,
			"perhaps. blame isn't part of git-plus so I can't think of anything that stands out yet. there is a git-blame package that users wanted to see merged into git-plus. maybe there's some insight there"
		);
	};

	resizeStream = () => {
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
		return this.props.posts.find(post => id === post.id);
	}

	// return a simple identifying string to represent the current path.
	// example is /path/to/foo.bar would just return "foo.bar"
	// FIXME -- this should be improved for systems that don't use "/"
	// as a path delimiter
	fileAbbreviation() {
		if (!this.props.currentFile) return "";
		return this.props.currentFile.replace(/.*\//g, "");
	}

	// we render both a main stream (postslist) plus also a postslist related
	// to the currently selected thread (if it exists). the reason for this is
	// to be able to animate between the two streams, since they will both be
	// visible during the transition
	render() {
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

		let placeholderText = "Message " + this.fileAbbreviation();
		// FIXME -- this doesn't update when it should for some reason
		if (threadPost) {
			placeholderText = "Reply to " + threadPost.author.username;
		}

		this.renderCommentMarkers();
		// this.installGutter();

		return (
			<div className={streamClass} ref={ref => (this._div = ref)}>
				<div
					className={postsListClass}
					ref={ref => (this._postslist = ref)}
					onClick={this.handleClickPost}
				>
					<div className="intro" ref={ref => (this._intro = ref)}>
						<label>
							<span className="logo">&#x2B22;</span>
							Welcome to the stream.<br />Info goes here.
						</label>
					</div>
					{posts.map(post => {
						// this needs to be done by storing the return value of the render,
						// then setting lastTimestamp, otherwise you wouldn't be able to
						// compare the current one to the prior one.
						const parentPost = posts.find(p => p.id === post.parentPostId);
						const returnValue = (
							<div key={post.id}>
								<DateSeparator timestamp1={lastTimestamp} timestamp2={post.createdAt} />
								<Post post={post} replyingTo={parentPost} />
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
					<PostDetails post={threadPost} />
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
										<Post post={post} />
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
		return [[location[0], location[1]], [location[2], location[3]]];
	}

	// comment markers are the annotation indicators that appear in the right
	// margin between the buffer and the codestream pane
	// this is only partially implemented, as it's very fragile as-is
	// improvement pending discussion with the team
	renderCommentMarkers = () => {
		let that = this;
		let editor = atom.workspace.getActiveTextEditor();
		if (!this.props.markers) return;
		if (this.markersRendered) return;
		this.markersRendered = true;
		this.props.markers.forEach(codeMarker => {
			console.log("Rendering a marker: ", codeMarker);
			let location = codeMarker.location;
			var range = [[location[0], 0], [location[0], 0]];
			var marker = editor.markBufferRange(range, { invalidate: "never" });
			// marker.setProperties({ codestreamStreamId: streamId });

			// FIXME -- get the real comment count
			var commentCount = Math.floor(Math.random() * 6 + 1);
			if (commentCount > 10) commentCount = "10+";
			commentCount = 2;

			let item = document.createElement("div");
			item.innerText = commentCount;
			item.className = "codestream-comment-popup";
			item.onclick = function() {
				that.selectPost(codeMarker.postId);
			};
			editor.decorateMarker(marker, { type: "overlay", item: item, class: "codestream-overlay" });
			this.tooltip = atom.tooltips.add(item, { title: "View comments" });

			return;

			// not using a gutter for now
			// let gutter = editor.gutterWithName("CodeStream");
			// if (gutter) {
			// 	var numCommentsDiv = document.createElement("div");
			// 	numCommentsDiv.innerText = commentCount;
			// 	gutter.decorateMarker(marker, {
			// 		class: "codestream-comment-marker",
			// 		item: numCommentsDiv
			// 	});
			// }
		});
	};

	// dismiss the thread stream and return to the main stream
	handleDismissThread = () => {
		this.setState({ threadId: null });
	};

	// by clicking on the post, we select it
	handleClickPost = event => {
		var postDiv = event.target.closest(".post");
		if (!postDiv) return;
		this.selectPost(postDiv.id);
	};

	// show the thread related to the given post, and if there is
	// a codeblock, scroll to it and select it
	selectPost = id => {
		let post = this.findPostById(id);
		if (!post) return;

		// if it is a child in the thread, it'll have a parentPostId,
		// otherwise use the id. any post can become the head of a thread
		let threadId = post.parentPostId || post.id;
		this.setState({ threadId: threadId });

		if (post.codeBlocks && post.codeBlocks.length) {
			let codeBlock = post.codeBlocks[0];
			let location = post.markerLocation;
			// console.log(post);
			if (location) {
				let markerRange = [[location[0], location[1]], [location[2], location[3]]];
				// FIXME -- switch to stream if code is from another buffer
				const editor = atom.workspace.getActiveTextEditor();
				if (this.marker) this.marker.destroy();
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
		if (document.activeElement && document.activeElement.id == "input-div")
			atom.workspace.getCenter().activate();
		else this.focusInput();
	};

	focusInput = () => {
		document.getElementById("input-div").focus();
	};

	handleClickScrollToNewMessages = () => {
		// console.log("CLICKED SCROLL DOWN");
		this._postslist.scrollTop = 100000;
	};

	handleClickDismissQuote = () => {
		// not very React-ish but not sure how to set focus otherwise
		this.focusInput();

		// FIXME remove any at-mentions that we have added manually
		this.setState({
			quoteText: "",
			quoteRange: null
		});
	};

	// figure out who to at-mention based on the git blame data.
	// insert the text into the compose field
	addBlameAtMention(selectionRange, gitData) {
		// console.log(data);
		var authors = {};
		for (var lineNum = selectionRange.start.row; lineNum <= selectionRange.end.row; lineNum++) {
			var lineData = gitData[lineNum - 1];
			if (lineData) {
				var author = lineData["author"];
				// FIXME -- skip it if it's me
				if (author && author !== "Not Committed Yet") {
					// find the author -- FIXME this feels fragile
					for (var index = 0; index < this.state.authors.length; index++) {
						let person = this.state.authors[index];
						if (person.fullName == author || person.nick == author) {
							authors["@" + person.nick] = true;
						}
					}
				}
			}
		}

		if (Object.keys(authors).length > 0) {
			var newText = Object.keys(authors).join(", ") + ": ";
			// console.log("NEWTEXT IS: >" + newText + "<");
			this.insertTextAtCursor(newText);
		}
	}

	// configure the compose field in preparation for a comment on a codeBlock
	// this is what happens when someone clicks the floating (+) popup
	handleClickAddComment = () => {
		let editor = atom.workspace.getActiveTextEditor();
		if (!editor) return;

		var range = editor.getSelectedBufferRange();
		let code = editor.getSelectedText();

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
			quoteText: code
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
		var newPostText = this.state.newPostText;

		console.log("ON KEYPRESS: " + event.key);
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
		this.handleSelectAtMention();
	}

	// set up the parameters to pass to the at mention popup
	showAtMentionSelectors(prefix) {
		let peopleToShow = [];

		for (var index = 0; index < this.state.authors.length; index++) {
			let person = this.state.authors[index];
			let toMatch = person.fullName + "*" + person.nick; // + "*" + person.email;
			let lowered = toMatch.toLowerCase();
			if (lowered.indexOf(prefix) !== -1) {
				peopleToShow.push(person);
			}
		}

		if (peopleToShow.length == 0) {
			this.setState({
				atMentionsOn: false
			});
		} else {
			let selected = peopleToShow[0].nick;

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
				selectedAtMention: this.state.atMentionsPeople[newIndex].nick
			});
		}
	}

	// close the at mention popup when the customer types ESC
	handleEscape(event) {
		if (this.state.atMentionsOn) this.setState({ atMentionsOn: false });
		else this.setState({ threadId: null });
	}

	// when the user hovers over an at-mention list item, change the
	// state to represent a hovered state
	handleHoverAtMention = nick => {
		let index = this.state.atMentionsPeople.findIndex(x => x.nick == nick);

		this.setState({
			atMentionsIndex: index,
			selectedAtMention: nick
		});
	};

	handleSelectAtMention = nick => {
		// if no nick is passed, we assume that we're selecting
		// the currently-selected at mention
		if (!nick) {
			nick = this.state.selectedAtMention;
		}

		// otherwise explicitly use the one passed in
		// FIXME -- this should anchor at the carat, not end-of-line
		var re = new RegExp("@" + this.state.atMentionsPrefix + "$");
		let text = this.state.newPostText.replace(re, "@" + nick);
		this.setState({
			atMentionsOn: false
		});
		let toInsert = nick.replace(this.state.atMentionsPrefix, "");
		this.insertTextAtCursor(toInsert);
		this.setNewPostText(text);
	};

	// insert the given text at the cursor of the input field
	insertTextAtCursor(text) {
		var sel, range, html;
		sel = window.getSelection();
		range = sel.getRangeAt(0);
		range.deleteContents();
		var textNode = document.createTextNode(text);
		range.insertNode(textNode);
		range.setStartAfter(textNode);
		sel.removeAllRanges();
		sel.addRange(range);
		this._contentEditable.htmlEl.normalize();
	}

	// create a new post
	submitPost(newText) {
		newText = newText.replace(/<br>/g, "\n");

		// convert the text to plaintext so there is no HTML
		var doc = new DOMParser().parseFromString(newText, "text/html");
		newText = doc.documentElement.textContent;
		console.log(this.state.quoteRange);
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
					// for now, we assume this codeblock came from this buffer
					streamId: this.props.id
				}
			];
		}

		this.props.createPost(this.props.id, this.state.threadId, newText, codeBlocks);

		// reset the input field to blank
		this.setState({
			newPostText: "",
			quoteRange: null,
			quoteText: ""
		});
	}
}

const getPostsForStream = (streamId = "", { byStream }) => {
	if (streamId === "") return [];
	return _.sortBy(byStream[streamId], "seqNum");
};

const getLocationsByPost = (locationsByCommit = {}, commitHash, markers) => {
	const locations = locationsByCommit[commitHash] || {};
	const locationsByPost = {};
	Object.keys(locations).forEach(markerId => {
		const marker = markers[markerId];
		locationsByPost[marker.postId] = locations[markerId];
	});
	return locationsByPost;
};

const getMarkersForStreamAndCommit = (locationsByCommit = {}, commitHash, markers) => {
	const locations = locationsByCommit[commitHash] || {};
	return Object.keys(locations).map(markerId => {
		const marker = markers[markerId];
		return {
			id: marker.id,
			postId: marker.postId,
			location: locations[markerId]
		};
	});
};

const mapStateToProps = ({ context, streams, users, posts, markers, markerLocations }) => {
	const stream = streams.byFile[context.currentFile] || {};
	const locations = getLocationsByPost(
		markerLocations.byStream[stream.id],
		context.currentCommit,
		markers
	);
	return {
		id: stream.id,
		currentFile: context.currentFile,
		markers: getMarkersForStreamAndCommit(
			markerLocations.byStream[stream.id],
			context.currentCommit,
			markers
		),
		posts: getPostsForStream(stream.id, posts).map(post => {
			const { username, email, firstName, lastName } = users[post.creatorId];
			return {
				...post,
				markerLocation: locations[post.id],
				author: { username, email, fullName: `${firstName} ${lastName}`.trim() }
			};
		})
	};
};

export default connect(mapStateToProps, actions)(SimpleStream);
