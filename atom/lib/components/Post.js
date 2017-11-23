import React, { Component } from "react";
//import Gravatar from "react-gravatar";

export default class Post extends Component {
	constructor(props) {
		super(props);
		this.state = {
			post: props.post
		};
	}

	componentDidMount() {
		// console.log("SCROLLING BECAUSE OF MOUNT");
		// FIXME -- probably don't want to be doing something to parent here
		this._div.parentNode.scrollTop = 10000;
	}

	render() {
		const { post } = this.state;
		const codeblock = post.codeblock ? <div className="code">{post.codeblock}</div> : "";

		// <Gravatar email="ppezaris@gmail.com" />
		return (
			<div className="post" id={post.id} onClick={this.handleClick} ref={ref => (this._div = ref)}>
				<span className="icon icon-gear" />
				<img className="headshot" src="http://i.imgur.com/N9iFDUq.png" />
				<author>{post.author}</author>
				<span className="timestamp">{post.timestamp}</span>
				<div className="body">
					{post.body}
					{codeblock}
				</div>
			</div>
		);
	}

	handleClick = async event => {
		console.log("CLICK ON POST: " + event.target.innerHTML);
	};
}
