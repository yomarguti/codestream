import React, { Component } from "react";
import Post from "./Post";

export default class SimpleStream extends Component {
	subscriptions = null;

	constructor(props) {
		super(props);
		this.state = {
			stream: {},
			posts: [
				{ id: 1, author: "linus", body: "this is a post", timestamp: "12:55AM" },
				{ id: 2, author: "tim", body: "this is another post", timestamp: "12:56AM" },
				{
					id: 3,
					author: "larry",
					body:
						"because of the way browsers work, although this will change the scrollbar thumb position, it will not change what you're looking at (i.e. posts won't shift around).",
					timestamp: "12:59AM"
				}
			]
		};
		let editor = atom.workspace.getActiveTextEditor();
		if (editor) {
			editor.onDidChangeSelectionRange(this.handleSelectionChange);
			this.editor = editor;
		}
	}

	render() {
		const posts = this.state.posts;
		const streamClass = atom.config.get("CodeStream.showHeadshots")
			? "stream"
			: "stream no-headshots";
		return (
			<div className={streamClass}>
				<div className="postslist">
					{posts.map(post => {
						return <Post post={post} />;
					})}
				</div>
				<div className="compose">
					<div
						contenteditable="true"
						className="input-div native-key-bindings"
						rows="1"
						tabIndex="-1"
						// onChange={e => this.setState({ newPostText: e.target.innerText })}
						onKeyPress={this.handleOnKeyPress}
					>
						{this.state.newPostText}
					</div>
				</div>
			</div>
		);
	}

	handleSelectionChange(event) {
		console.log("SELECTION HAS CHANGED");
		console.log(event);
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
			this.setState({ newPostText: newText });
		}
	}

	handleOnKeyPress = async event => {
		var innerText = event.target.innerText;
		this.setState({ newPostText: innerText });
		console.log(event.key + " set state to: " + innerText);
		if (this.atMentionsOn) {
			if (event.key == "Escape") {
				this.hideAtMentionSelectors();
			} else {
				var match = $(this)
					.val()
					.match(/@([a-zA-Z]*)$/);
				var text = match ? match[0].replace(/@/, "") : "";
				this.showAtMentionSelectors(text);
			}
		} else if (event.key == "Escape") {
			that.slideThreadOut();
		} else if (event.key == "Enter" && !event.shiftKey) {
			event.preventDefault();
			if (innerText.length > 0) {
				this.submitPost(innerText);
			} else {
				// don't submit blank posts
			}
		}
	};

	submitPost(newText) {
		var newPost = {
			// FIXME fake data
			id: 3,
			author: "pez",
			body: newText,
			timestamp: "just now"
		};
		let editor = atom.workspace.getActiveTextEditor();
		if (editor) {
			let code = editor.getSelectedText();
			if (code.length > 0) {
				// FIXME -- remove common leading whitespace if possible
				newPost.codeblock = code;
			}
		}
		this.setState(prevState => ({
			posts: [...prevState.posts, newPost]
		}));
		this.setState({ newPostText: "" });
	}
}
