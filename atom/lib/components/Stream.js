import React, { Component } from "react";
import Post from "./Post";
import AtMentionsPopup from "./AtMentionsPopup";
import ContentEditable from "react-contenteditable";
import { CompositeDisposable } from "atom";

export default class SimpleStream extends Component {
	subscriptions = null;

	constructor(props) {
		super(props);
		this.state = {
			stream: {},
			posts: [
				{
					id: 1,
					author: "akonwi",
					body: "this is a post",
					timestamp: "12:55AM",
					email: "akonwi@codestream.com"
				},
				{
					id: 2,
					author: "jj",
					body: "this is another post",
					timestamp: "12:56AM",
					email: "jj@codestream.com"
				},
				{
					id: 3,
					author: "marcelo",
					body:
						"because of the way browsers work, @pez although this will change the scrollbar thumb position, it will not change what @akonwi is looking at (i.e. posts won't shift around).",
					timestamp: "12:59AM",
					email: "marcelo@codestream.com"
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
		let editor = atom.workspace.getActiveTextEditor();
		if (editor) {
			editor.onDidChangeSelectionRange(this.handleSelectionChange);
			this.editor = editor;
		}
		this.handleOnKeyDown = this.handleOnKeyDown.bind(this);
		this.handleOnKeyPress = this.handleOnKeyPress.bind(this);
		this.handleHoverAtMention = this.handleHoverAtMention.bind(this);
		this.handleSelectAtMention = this.handleSelectAtMention.bind(this);

		this.subscriptions = new CompositeDisposable();
		this.subscriptions.add(
			atom.commands.add(".codestream .compose.mentions-on", {
				"codestream:at-mention-move-up": event => this.handleAtMentionKeyPress(event, "up"),
				"codestream:at-mention-move-down": event => this.handleAtMentionKeyPress(event, "down"),
				"codestream:at-mention-escape": event => this.handleAtMentionKeyPress(event, "escape")
			})
		);
	}

	render() {
		const posts = this.state.posts;
		const streamClass = atom.config.get("CodeStream.showHeadshots")
			? "stream"
			: "stream no-headshots";
		const composeClass = this.state.atMentionsOn ? "compose mentions-on" : "compose";

		let newPostText = this.state.newPostText || "";

		// strip out the at-mention markup, and add it back.
		// newPostText = newPostText.replace(/(@\w+)/g, '<span class="at-mention">$1</span> ');

		return (
			<div className={streamClass}>
				<div className="postslist">
					{posts.map(post => {
						return <Post post={post} />;
					})}
				</div>
				<AtMentionsPopup
					on={this.state.atMentionsOn}
					people={this.state.atMentionsPeople}
					prefix={this.state.atMentionsPrefix}
					selected={this.state.selectedAtMention}
					handleHoverAtMention={this.handleHoverAtMention}
					handleSelectAtMention={this.handleSelectAtMention}
				/>
				<div className={composeClass} onKeyPress={this.handleOnKeyPress}>
					<ContentEditable
						className="input-div native-key-bindings"
						rows="1"
						tabIndex="-1"
						onChange={this.handleOnChange}
						onKeyDown={this.handleOnKeyDown}
						html={newPostText}
					/>
				</div>
			</div>
		);
	}
	// {postTextArray.map(fragment => {
	// 	console.log("FRAGMENT IS: " + fragment);
	// 	return fragment;
	// })}
	// onChange={e => this.setState({ newPostText: e.target.innerText })}

	setNewPostText(text) {
		// text = text.replace(/<span class="at-mention">(@\w+)<\/span> /g, "$1");
		// text = text.replace(/(@\w+)/g, <span class="at-mention">$1</span>);
		this.setState({ newPostText: text });
	}

	handleSelectionChange(event) {
		// FIXME if there is text selected, add a UI element to make it easy to
		// understand that you can add a comment
		return;
		let editor = atom.workspace.getActiveTextEditor();
		if (editor) {
			var selectionRange = editor.getSelectedBufferRange();
			console.log(selectionRange);
			let code = editor.getSelectedText();
			if (code.length > 0) {
				console.log("READY TO QUOTE CODE");
			}
			let startRange = [
				[selectionRange.start.row, selectionRange.start.column],
				[selectionRange.end.row, selectionRange.end.column]
			];
			var marker = editor.markBufferRange(selectionRange, { invalidate: "touch" });
			//marker.setProperties({ cider_stream_id: stream_id });
			let item = document.createElement("div");
			item.innerHTML = "Comment";
			item.className = "codestream-add-comment";
			editor.decorateMarker(marker, {
				type: "overlay",
				// class: "codestream-add-comment",
				position: "head",
				// onlyHead: true
				item: item
			});
		}
	}

	addBlameAtMention(selectionRange, gitData) {
		// console.log(data);
		var authors = [];
		for (var lineNum = selectionRange.start.row; lineNum <= selectionRange.end.row; lineNum++) {
			var lineData = gitData[lineNum - 1];
			if (lineData) {
				var author = lineData["author"];
				if (author !== "Not Committed Yet" && author !== "Peter Pezaris") {
					authors.push(author);
				}
			}
		}
		authors = _.uniq(authors);
		console.log("AUTHORS ARE: " + authors);
		if (authors.length > 0) {
			var newText = authors.join(", ") + ": " + this.state.newPostText;
			this.setNewPostText(newText);
		}
	}

	handleOnChange = async event => {
		var newPostText = event.target.value;

		// FIXME -- this should anchor at the carat not end of line
		var match = newPostText.match(/@([a-zA-Z]*)$/);
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
		this.setNewPostText(newPostText);
	};

	handleOnKeyDown = async event => {
		console.log("ON KEY DOWN");
	};

	handleOnKeyPress = async event => {
		var newPostText = this.state.newPostText;

		console.log("ON KEYPRESS");
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
		if (eventType == "escape") {
			this.setState({
				atMentionsOn: false
			});
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

	handleHoverAtMention(nick) {
		let index = this.state.atMentionsPeople.findIndex(x => x.nick == nick);

		console.log(index);
		this.setState({
			atMentionsIndex: index,
			selectedAtMention: nick
		});
	}

	handleSelectAtMention(nick) {
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
		this.setNewPostText(text);
	}

	submitPost(newText) {
		newText = newText.replace(/<br>/g, "\n");
		var newPost = {
			// FIXME fake data
			id: 3,
			author: "pez",
			body: newText,
			email: "pez@codestream.com",
			timestamp: "just now"
		};
		let editor = atom.workspace.getActiveTextEditor();
		if (editor) {
			// FIXME -- don't always assume selected text is meant to be quoted
			let code = editor.getSelectedText();
			if (code.length > 0) {
				// FIXME -- remove common leading whitespace if possible
				newPost.codeblock = code;
			}
		}
		// FIXME -- add the posts to some collection rather than directly
		// manipulating state
		this.setState(prevState => ({
			posts: [...prevState.posts, newPost]
		}));
		// reset the input field to blank
		this.setState({ newPostText: "" });
	}
}
