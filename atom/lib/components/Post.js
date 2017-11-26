import React, { Component } from "react";
import Gravatar from "react-gravatar";
import Timestamp from "./Timestamp";

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
		let currentScroll = this._div.parentNode.scrollTop;
		this._div.parentNode.parentNode.scrollTop = 10000;
	}

	render() {
		const { post } = this.state;
		const codeblock = post.quoteText ? <div className="code">{post.quoteText}</div> : "";

		// FIXME -- only replace the at-mentions of actual authors, rather than any
		// string that starts with an @
		let body = post.body.replace(/(@\w+)/g, <span class="at-mention">$1</span>);
		let bodyParts = post.body.split(/(@\w+)/);

		// FIXME use a real email address
		return (
			<div className="post" id={post.id} onClick={this.handleClick} ref={ref => (this._div = ref)}>
				<span className="icon icon-gear" onClick={this.handleMenuClick} />
				<Gravatar
					className="headshot"
					size={36}
					default="retro"
					protocol="http://"
					email={post.email}
				/>
				<author>{post.author}</author>
				<Timestamp time={post.timestamp} />
				<div className="body">
					{bodyParts.map(part => {
						if (part.charAt(0) == "@") {
							return <span class="at-mention">{part}</span>;
						} else {
							return part;
						}
					})}
					{codeblock}
				</div>
			</div>
		);
	}

	handleClick = async event => {
		console.log("CLICK ON POST: " + event.target.innerHTML);
	};

	handleMenuClick = async event => {
		event.stopPropagation();
		console.log("CLICK ON MENU: ");
	};
}
