import React, { Component } from "react";
import Post from "./Post";

export default class Stream extends Component {
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
	}

	render() {
		const posts = this.state.posts;
		return (
			<div className="stream">
				<div className="postslist">
					{posts.map(post => {
						return <Post post={post} />;
					})}
				</div>
				<form className="compose" onSubmit={this.submitPost}>
					<textarea
						rows="1"
						value={this.state.newPostText}
						onChange={e => this.setState({ newPostText: e.target.value })}
						onKeyPress={this.handleOnKeyPress}
						className="native-key-bindings"
						placeholder="Type here FIXME loc"
					/>
				</form>
			</div>
		);
	}

	handleOnKeyPress = async event => {
		var value = event.target.value;
		console.log(event.key);
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
		} else if (event.key == "Enter") {
			this.submitPost();
		}
	};

	submitPost = async event => {
		var newPost = {
			// FIXME fake data
			id: 3,
			author: "pez",
			body: this.state.newPostText,
			timestamp: "just now"
		};
		let editor = atom.workspace.getActiveTextEditor();
		if (editor) {
			let code = editor.getSelectedText();
			if (code.length > 0) {
				newPost.codeblock = code;
			}
		}
		this.setState(prevState => ({
			posts: [...prevState.posts, newPost]
		}));
	};
}
