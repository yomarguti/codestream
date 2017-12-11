import { CompositeDisposable } from "atom";
import React, { Component } from "react";
import { connect } from "react-redux";
import ContentEditable from "react-contenteditable";
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
			streamName: "Dummy.js",
			posts: [
				{
					id: 1,
					author: {
						username: "akonwi",
						email: "akonwi@codestream.com",
						fullName: "Akonwi Ngoh"
					},
					text: "this is a post",
					createdAt: 1410650773000
				},
				{
					id: 2,
					author: {
						username: "jj",
						email: "jj@codestream.com",
						fullName: "James Price"
					},
					text: "this is another post",
					createdAt: 1411680773000
				},
				{
					id: 2,
					author: {
						username: "colin",
						email: "colin@codestream.com",
						fullName: "Colin Stryker"
					},
					text: "AvE adds more value to my life than some of my family members",
					createdAt: 1411680774000,
					newSeparator: true
				},
				{
					id: 3,
					author: {
						username: "marcelo",
						email: "marcelo@codestream.com",
						fullName: "Marcelo"
					},
					text:
						"because of the way browsers work, @pez although this will change the scrollbar thumb position, it will not change what @akonwi is looking at (i.e. posts won't shift around).",
					createdAt: 1501650773000
				}
			],
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

	componentDidUpdate(prevProps, prevState) {
		this._postslist.scrollTop = 100000;
	}

	componentWillReceiveProps(nextProps) {
		if (!nextProps.id) this.props.fetchStream();
	}

	handleResizeCompose = () => {
		// console.log("COMPOSE RESIZE");
		this.resizeStream();
	};

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
		this._postslist.scrollTop = 100000;
	};

	componentDidMount() {
		if (!this.props.id) this.props.fetchStream();
		// TODO: scroll to bottom
		new ResizeObserver(this.handleResizeCompose).observe(this._compose);
		document.querySelector('div[contenteditable="true"]').addEventListener("paste", function(e) {
			e.preventDefault();
			var text = e.clipboardData.getData("text/plain");
			document.execCommand("insertHTML", false, text);
		});

		console.log("WE MOUNTED THE STREAM COMPONENT");
	}

	findPostById(id) {
		let foundPost = null;
		this.props.posts.map(post => {
			if (id && id == post.id) foundPost = post;
		});
		return foundPost;
	}

	render() {
		const posts = this.state.posts;
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
				<span onClick={this.handleClickDismissQuote} class="icon icon-x" />
			</div>
		) : (
			""
		);

		var threadKeyMap = {};
		var threadKeyCounter = 0;
		this.props.posts.map(post => {
			if (post.parentPostId) {
				if (!threadKeyMap[post.parentPostId]) {
					threadKeyMap[post.parentPostId] = threadKeyCounter++;
				}
			}
		});

		let lastTimestamp = null;
		let threadId = this.state.threadId;
		let threadPost = this.findPostById(threadId);
		let hasNewMessagesBelowFold = false;

		let placeholderText = "Message " + this.state.streamName;
		// FIXME -- this doesn't update when it should for some reason
		if (threadPost) {
			placeholderText = "Reply to " + threadPost.author.username;
		}

		return (
			<div className={streamClass} ref={ref => (this._div = ref)}>
				<style id="dynamic-add-comment-popup-style" />
				<div
					className={postsListClass}
					ref={ref => (this._postslist = ref)}
					onClick={this.handleClickPost}
				>
					<div className="intro" ref={ref => (this._intro = ref)}>
						<label>
							<span class="logo">&#x2B22;</span>
							Welcome to the stream.<br />Info goes here.
						</label>
					</div>
					{this.props.posts.map(post => {
						// this needs to be done by storing the return value of the render,
						// then setting lastTimestamp, otherwise you wouldn't be able to
						// compare the current one to the prior one.
						const threadKey = threadKeyMap[post.parentPostId] || threadKeyMap[post.id] || 0;
						const returnValue = (
							<div key={post.id}>
								<DateSeparator timestamp1={lastTimestamp} timestamp2={post.createdAt} />
								<Post post={post} threadKey={threadKey} />
							</div>
						);
						lastTimestamp = post.createdAt;
						return returnValue;
					})}
				</div>

				<div
					className={threadPostsListClass}
					ref={ref => (this._threadpostslist = ref)}
					onclick={this.handleClickPost}
				>
					<div id="close-thread" onClick={this.handleDismissThread}>
						&larr; Back to stream
					</div>
					<PostDetails post={threadPost} />
					{
						(lastTimestamp =
							0 ||
							this.props.posts.map(post => {
								if (threadId && threadId != post.parentPostId) {
									return null;
								}
								// this needs to be done by storing the return value of the render,
								// then setting lastTimestamp, otherwise you wouldn't be able to
								// compare the current one to the prior one.
								const returnValue = (
									<div key={post.id}>
										<DateSeparator timestamp1={lastTimestamp} timestamp2={post.createdAt} />
										<Post post={post} lastDay={lastTimestamp} />
									</div>
								);
								lastTimestamp = post.createdAt;
								return returnValue;
							}))
					}
				</div>

				<AddCommentPopup handleClickAddComment={this.handleClickAddComment} />
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
					<ContentEditable
						className="native-key-bindings"
						id="input-div"
						rows="1"
						tabIndex="-1"
						onChange={this.handleOnChange}
						html={newPostText}
						placeholder={placeholderText}
						ref={ref => (this._contentEditable = ref)}
					/>
					{quoteHint}
					{quoteInfo}
				</div>
			</div>
		);
	}

	handleDismissThread = () => {
		this.setState({ threadId: null });
	};

	handleClickPost = event => {
		var postDiv = event.target.closest(".post");
		if (!postDiv) return;
		console.log("Setting thread id to: " + postDiv.getAttribute("thread"));
		if (postDiv.getAttribute("thread")) {
			// console.log("Setting thread id to: " + postDiv.thread);
			this.setState({ threadId: postDiv.getAttribute("thread") });
		}
	};

	setNewPostText(text) {
		// text = text.replace(/<span class="at-mention">(@\w+)<\/span> /g, "$1");
		// text = text.replace(/(@\w+)/g, <span class="at-mention">$1</span>);
		console.log("SETTING TEXT TO: " + text);
		console.log(this._contentEditable);
		// this._contentEditable.htmlEl.innerHTML = text;
		this.setState({ newPostText: text });
	}

	toggleFocusInput = () => {
		if (document.activeElement && document.activeElement.id == "input-div")
			atom.workspace.getCenter().activate();
		else this.focusInput();
	};

	focusInput = () => {
		document.getElementById("input-div").focus();
	};

	handleClickScrollToNewMessages = () => {
		console.log("CLICKED SCROLL DOWN");
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
						if (person.fullName == author) {
							authors["@" + person.nick] = true;
						}
					}
				}
			}
		}

		if (Object.keys(authors).length > 0) {
			var newText = Object.keys(authors).join(", ") + " " + (this.state.newPostText || "");
			this.setNewPostText(newText);
		}
	}

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
					that.addBlameAtMention(range, data, that.input);
				});
			} else {
				that.addBlameAtMention(range, that.blameData[filePath], that.input);
			}
		});

		// not very React-ish but not sure how to set focus otherwise
		document.getElementById("input-div").focus();

		this.setState({
			quoteRange: range,
			quoteText: code
		});
	};

	reportRange() {
		var sel, range, html;
		sel = window.getSelection();
		range = sel.getRangeAt(0);
	}

	handleOnChange = async event => {
		var newPostText = event.target.value;

		this.reportRange();
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

		// console.log("ON KEYPRESS");
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
			}
			this.setState({
				atMentionsIndex: newIndex,
				selectedAtMention: this.state.atMentionsPeople[newIndex].nick
			});
		}
	}

	handleEscape(event) {
		if (this.state.atMentionsOn) this.setState({ atMentionsOn: false });
		else this.setState({ threadId: null });
	}

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

		// console.log("HANDLING SAM: " + this.state.newPostText);
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

	submitPost(newText) {
		newText = newText.replace(/<br>/g, "\n");

		// convert the text to plaintext so there is no HTML
		var doc = new DOMParser().parseFromString(newText, "text/html");
		newText = doc.documentElement.textContent;

		// TODO: add selected snippet to post
		// if (this.state.quoteText) {
		// 	newPost.quoteText = this.state.quoteText;
		// 	newPost.quoteRange = this.state.quoteRange;
		// }
		// var timestamp = +new Date();
		// var newPost = {
		// 	// FIXME fake data
		// 	id: 3,
		// 	nick: "pez",
		// 	fullName: "Peter Pezaris",
		// 	text: newText,
		// 	email: "pez@codestream.com",
		// 	timestamp: timestamp
		// };

		this.props.createPost(this.props.id, this.state.threadId, newText);

		// reset the input field to blank
		this.setState({
			newPostText: "",
			quoteRange: null,
			quoteText: ""
		});
	}
}

const getPostsForStream = (streamId = "", { byStream, sortPerStream }) => {
	if (streamId === "") return [];
	const posts = byStream[streamId];
	return (sortPerStream[streamId] || []).map(id => posts[id]);
};

const mapStateToProps = ({ context, streams, users, posts }) => {
	const stream = streams.byFile[context.currentFile] || {};
	return {
		id: stream.id,
		posts: getPostsForStream(stream.id, posts).map(post => {
			const { username, email, firstName, lastName } = users[post.creatorId];
			return {
				...post,
				author: { username, email, fullName: `${firstName} ${lastName}`.trim() }
			};
		})
	};
};

export default connect(mapStateToProps, actions)(SimpleStream);
