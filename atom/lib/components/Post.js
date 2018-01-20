import React, { Component } from "react";
import Headshot from "./Headshot";
import Timestamp from "./Timestamp";
import Menu from "./Menu";
import PostDetails from "./PostDetails";
import createClassString from "classnames";

export default class Post extends Component {
	constructor(props) {
		super(props);
		this.state = {
			post: props.post,
			menuOpen: false
		};
	}

	componentDidMount() {
		// FIXME -- probably don't want to be doing something to parent here
		let streamDiv = this._div.parentNode.parentNode;
		let currentScroll = streamDiv.scrollTop;
		let scrollHeight = streamDiv.scrollHeight;
		let offBottom = scrollHeight - currentScroll - streamDiv.offsetHeight - this._div.offsetHeight;
		// if i am manually scrolling, don't programatically scroll to bottom
		// unless the post is mine, in which case we always scroll to bottom
		// we check to see if it's below 100 because if you are scrolled
		// almost to the bottom, we count that as being at the bottom for UX reasons
		if (offBottom < 100 || this.state.post.username == "pez") {
			// big number to make sure we've scrolled all the way down
			streamDiv.scrollTop = 100000;
			// console.log("SCROLLING TO BOTTOM");
		} else {
			// console.log("*********NOT SCROLLING TO BOTTOM");
		}

		if (this.props.post.author.fullName)
			atom.tooltips.add(this._authorDiv, { title: this.props.post.author.fullName });

		// atom.tooltips.add($icon.get(0), {'title': 'This block of code is different than your current copy.'});
	}

	render() {
		const { post } = this.state;

		const postClass = createClassString({
			post: true,
			"new-separator": this.props.newMessageIndicator,
			[`thread-key-${this.props.threadKey}`]: true
		});

		let codeBlock = null;
		let alert = null;
		if (post.codeBlocks && post.codeBlocks.length) {
			let code = post.codeBlocks[0].code;
			codeBlock = <div className="code">{code}</div>;
		}

		// FIXME -- only replace the at-mentions of actual authors, rather than any
		// string that starts with an @
		let usernameRegExp = new RegExp("(@(?:" + this.props.usernames + "))");
		let bodyParts = post.text.split(usernameRegExp);

		// let menuItems = [
		// 	{ label: "Create Thread", key: "make-thread" },
		// 	{ label: "Mark Unread", key: "mark-unread" },
		// 	// { label: "Add Reaction", key: "add-reaction" },
		// 	// { label: "Pin to Stream", key: "pin-to-stream" },
		// 	{ label: "Edit Message", key: "edit-message" },
		// 	{ label: "Delete Message", key: "delete-message" }
		// ];

		// let menu = this.state.menuOpen ? (
		// <Menu items={menuItems} handleSelectMenu={this.handleSelectMenu} />
		// ) : null;

		let parentPost = this.props.replyingTo;
		let alertClass = this.props.alert ? "icon icon-" + this.props.alert : null;

		// this was above Headshot
		// <span className="icon icon-gear" onClick={this.handleMenuClick} />
		// {menu}

		// FIXME use a real email address
		return (
			<div
				className={postClass}
				id={post.id}
				thread={post.parentPostId || post.id}
				ref={ref => (this._div = ref)}
			>
				<Headshot size={36} person={post.author} />
				<span className="author" ref={ref => (this._authorDiv = ref)}>
					{post.author.username}
				</span>
				<Timestamp time={post.createdAt} />
				<div className="body">
					{parentPost && (
						<div className="replying-to">
							<span>reply to</span> <b>{parentPost.text.substr(0, 80)}</b>
						</div>
					)}
					{codeBlock}
					{this.props.showDetails && (
						<PostDetails post={post} currentCommit={this.props.currentCommit} />
					)}
					{alertClass && <span className={alertClass} />}
					{bodyParts.map(part => {
						if (part.match(usernameRegExp)) {
							if (part === "@" + this.props.currentUsername)
								return (
									<span key={part} className="at-mention me">
										{part}
									</span>
								);
							else
								return (
									<span key={part} className="at-mention">
										{part}
									</span>
								);
						} else {
							return part;
						}
					})}
				</div>
			</div>
		);
	}

	handleMenuClick = async event => {
		event.stopPropagation();
		this.setState({ menuOpen: !this.state.menuOpen });
		console.log("CLICK ON MENU: ");
	};

	handleSelectMenu = (event, id) => {
		console.log("Clicked: " + id);
		event.stopPropagation();
		this.setState({ menuOpen: false });
	};
}
