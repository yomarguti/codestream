import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import Linkify from "react-linkify";
import Headshot from "./Headshot";
import Icon from "./Icon";
import Timestamp from "./Timestamp";
// import Menu from "./Menu";
import PostDetails from "./PostDetails";
import RetrySpinner from "./RetrySpinner";
import { retryPost, cancelPost } from "./actions";
import ContentEditable from "react-contenteditable";
import Button from "./Button";
import Menu from "./Menu";
// import "emoji-mart/css/emoji-mart.css";
import { Picker } from "emoji-mart";
// import markdown from "markdown-it";

// const md = markdown({
// 	linkify: true,
// 	breaks: true,
// 	typographer: true
// });

class Post extends Component {
	constructor(props) {
		super(props);
		this.state = {
			menuOpen: false,
			authorMenuOpen: false
		};
	}

	resubmit = () => this.props.retryPost(this.props.post.id);

	cancel = () => this.props.cancelPost(this.props.post.id);

	render() {
		const { post } = this.props;
		const { menuOpen, authorMenuOpen, menuTarget } = this.state;

		const mine = this.props.currentUsername === post.author.username;
		const systemPost = post.creatorId === "codestream";

		const postClass = createClassString({
			post: true,
			mine: mine,
			editing: this.props.editing,
			"system-post": systemPost,
			unread: this.props.unread,
			"new-separator": this.props.newMessageIndicator,
			[`thread-key-${this.props.threadKey}`]: true
		});

		let codeBlock = null;
		if (post.codeBlocks && post.codeBlocks.length) {
			let code = post.codeBlocks[0].code;
			codeBlock = (
				<div className="code-reference">
					<span>{post.codeBlocks[0].file || "-"}</span>
					<div className="code">{code}</div>
				</div>
			);
		}

		let parentPost = this.props.replyingTo;

		let menuItems = [];

		if (!this.props.showDetails) {
			const threadLabel = parentPost || post.hasReplies ? "View Thread" : "Start a Thread";
			menuItems.push({ label: threadLabel, action: "make-thread" });
		}

		menuItems.push({ label: "Mark Unread", action: "mark-unread" });
		// { label: "Add Reaction", action: "add-reaction" },
		// { label: "Pin to Stream", action: "pin-to-stream" }

		if (mine) {
			menuItems.push(
				{ label: "-" },
				{ label: "Edit Comment", action: "edit-post" },
				{ label: "Delete Comment", action: "delete-post" }
			);
		}

		let authorMenuItems = [];
		// if (this.state.authorMenuOpen) {
		authorMenuItems.push({
			fragment: (
				<div className="headshot-popup">
					<Headshot size={144} person={post.author} />
					<div className="author-details">
						<div className="author-username">@{post.author.username}</div>
						<div className="author-fullname">{post.author.fullName}</div>
					</div>
				</div>
			)
		});
		if (mine) {
			authorMenuItems.push({ label: "Edit Headshot", action: "edit-headshot" });
		} else {
			authorMenuItems.push(
				{ label: "Live Share", action: "live-share" },
				{ label: "Direct Message", action: "direct-message" }
			);
		}
		// }
		// let alertClass = this.props.alert ? "icon icon-" + this.props.alert : null;

		// this was above Headshot
		// <span className="icon icon-gear" onClick={this.handleMenuClick} />
		// {menu}

		return (
			<div
				className={postClass}
				id={post.id}
				data-seq-num={post.seqNum}
				thread={post.parentPostId || post.id}
				ref={ref => (this._div = ref)}
			>
				{!systemPost && (
					<Icon name="gear" className="gear align-right" onClick={this.handleMenuClick} />
				)}
				{menuOpen && <Menu items={menuItems} target={menuTarget} action={this.handleSelectMenu} />}
				{authorMenuOpen && (
					<Menu
						items={authorMenuItems}
						target={menuTarget}
						action={this.handleSelectMenu}
						align="left"
					/>
				)}
				<Headshot size={36} person={post.author} mine={mine} onClick={this.handleHeadshotClick} />
				<span className="author" ref={ref => (this._authorDiv = ref)}>
					{post.author.username}
					{this.renderEmote(post)}
				</span>
				{post.error ? (
					<RetrySpinner callback={this.resubmit} cancel={this.cancel} />
				) : (
					<Timestamp time={post.createdAt} />
				)}
				<div className="body">
					{parentPost && (
						<div className="replying-to">
							<span>reply to</span> <b>{parentPost.text.substr(0, 80)}</b>
						</div>
					)}
					{post.creatorId === "codestream" && (
						<div className="replying-to">
							<span>only visible to you</span>
						</div>
					)}
					{codeBlock}
					{this.props.showDetails && (
						<PostDetails post={post} currentCommit={this.props.currentCommit} />
					)}
					{/* {alertClass && <span className={alertClass} />} */}
					{this.renderBody(post)}
					{!this.props.editng && post.hasBeenEdited && <span className="edited">(edited)</span>}
				</div>
			</div>
		);
	}

	renderEmote = post => {
		let matches = post.text.match(/^\/me\s+(.*)/);
		if (matches) return <span className="emote">{this.renderTextLinkified(matches[1])}</span>;
		else return null;
	};

	renderBody = post => {
		if (this.props.editing) return this.renderBodyEditing(post);
		else if (post.text.match(/^\/me\s/)) return null;
		else return this.renderTextLinkified(post.text);
	};

	renderTextLinkified = text => {
		let usernameRegExp = new RegExp("(@(?:" + this.props.usernames.toLowerCase() + ")\\b)", "i");
		let bodyParts = text.split(usernameRegExp);
		let iterator = 0;
		const meLowerCase = "@" + this.props.currentUsername.toLowerCase();

		return bodyParts.map(part => {
			const partLowerCase = part.toLowerCase();
			if (partLowerCase.match(usernameRegExp)) {
				if (partLowerCase === meLowerCase)
					return (
						<span key={iterator++} className="at-mention me">
							{part}
						</span>
					);
				else
					return (
						<span key={iterator++} className="at-mention">
							{part}
						</span>
					);
			} else {
				return <Linkify key={iterator++}>{part}</Linkify>;
				// return part;
				// const result = md.render(part);
				// return <span dangerouslySetInnerHTML={{ __html: result }} />;
				// return <ReactMarkdown key={iterator++}>{part}</ReactMarkdown>;
			}
		});
	};

	renderBodyEditing = post => {
		const id = "input-div-" + post.id;

		return (
			<div className="edit-post">
				<ContentEditable
					className="native-key-bindings message-input"
					id={id}
					rows="1"
					tabIndex="-1"
					onChange={this.handleOnChange}
					onBlur={this.handleOnBlur}
					html={post.text}
					ref={ref => (this._contentEditable = ref)}
				/>
				<div className="button-group">
					<Button
						id="save-button"
						className="control-button"
						tabIndex="2"
						type="submit"
						loading={this.props.loading}
						onClick={this.handleClickSave}
					>
						Save
					</Button>
					<Button
						id="discard-button"
						className="control-button cancel"
						tabIndex="2"
						type="submit"
						loading={this.props.loading}
						onClick={this.handleClickDiscard}
					>
						Discard
					</Button>
				</div>
			</div>
		);
	};

	componentDidUpdate(prevProps, _prevState) {
		if (this.props.editing && !prevProps.editing) {
			document.getElementById("input-div-" + this.props.post.id).focus();
		}
	}

	handleMenuClick = async event => {
		event.stopPropagation();
		this.setState({ menuOpen: !this.state.menuOpen, menuTarget: event.target });
	};

	handleHeadshotClick = async event => {
		console.log("HANDLED!");
		event.stopPropagation();
		this.setState({ authorMenuOpen: !this.state.authorMenuOpen, menuTarget: event.target });
	};

	handleSelectMenu = action => {
		this.props.action(action, this.props.post);
		this.setState({ menuOpen: false, authorMenuOpen: false });
	};
}

export default connect(
	null,
	{ cancelPost, retryPost }
)(Post);
