import React, { Component } from "react";
import Post from "./Post";

export default class Stream extends Component {
	constructor(props) {
		super(props);
		this.state = {
			stream: {
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
			}
		};
	}

	render() {
		const { stream } = this.state;
		this.post();
		return (
			<div className="stream">
				<div className="postslist">
					{stream.posts.map(post => {
						return <Post post={post} />;
					})}
				</div>
				<div className="compose">
					<textarea rows="1" className="native-key-bindings" placeholder="Type here FIXME loc" />
				</div>
			</div>
		);
	}

	post() {
		const { stream } = this.state;
		var newPost = { id: 3, author: "pez", body: "new post!", timestamp: "just now" };
		stream.posts.push(newPost);
	}
}
