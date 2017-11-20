import React, { Component } from "react";

export default class Chat extends Component {
	constructor(props) {
		super(props);
		this.state = {
			stream: {
				posts: [{ id: 1, content: "this is a post" }]
			}
		};
	}

	render() {
		const { stream } = this.state;

		return (
			<div>
				<ul>
					{stream.posts.map(post => {
						return <li key={post.id}>{post.content}</li>;
					})}
				</ul>
				<textarea className="input-textarea" placeholder="Type here" />
			</div>
		);
	}
}
