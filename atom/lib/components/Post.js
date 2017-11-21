import React, { Component } from "react";

export default class Post extends Component {
	constructor(props) {
		super(props);
		this.state = {
			post: props.post
		};
	}

	render() {
		const { post } = this.state;

		return (
			<div className="post" id={post.id}>
				<span className="icon icon-gear" />
				<img className="headshot" src="http://i.imgur.com/N9iFDUq.png" />
				<author>{post.author}</author>
				<span className="timestamp">{post.timestamp}</span>
				<div className="body">{post.body}</div>
			</div>
		);
	}
}
