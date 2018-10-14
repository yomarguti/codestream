import React from "react";
import * as Path from "path";
import { connect } from "react-redux";
import { injectIntl } from "react-intl";
import createClassString from "classnames";
import Headshot from "./Headshot";
import Icon from "./Icon";
import Timestamp from "./Timestamp";
import PostDetails from "./PostDetails";
import RetrySpinner from "./RetrySpinner";
import { retryPost, cancelPost, showCode } from "./actions";
import ContentEditable from "react-contenteditable";
import Button from "./Button";
import Menu from "./Menu";
import EmojiPicker from "./EmojiPicker";
import Tooltip from "./Tooltip";
import { getById } from "../reducers/repos";
import { getPost } from "../reducers/posts";
import { markdownify, emojify } from "./Markdowner";
import hljs from "highlight.js";
import _ from "underscore";
import { reactToPost } from "./actions";
import { safe } from "../utils";

let renderCount = 0;
class Post extends React.Component {
	state = {
		emojiOpen: false,
		emojiTarget: null,
		menuOpen: false,
		menuTarget: null,
		authorMenuOpen: false,
		warning: null
	};

	componentDidMount() {
		if (this.props.didTriggerThread) {
			this.showCode(true);
		}
	}

	shouldComponentUpdate(nextProps, nextState) {
		const postChanged = true; //  nextProps.post.version !== this.props.post.version;

		const propsChanged = Object.entries(this.props).some(([prop, value]) => {
			return !["userNames", "post"].includes(prop) && value !== this.props[prop];
		});
		const userNamesChanged = !_.isEqual(this.props.userNames, nextProps.userNames);
		const stateChanged = !_.isEqual(this.state, nextState);
		const shouldUpdate = propsChanged || userNamesChanged || postChanged || stateChanged;
		return shouldUpdate;
	}

	componentDidUpdate(prevProps, _prevState) {
		const editStateToggledOn = this.props.editing && !prevProps.editing;
		if (editStateToggledOn) {
			document.getElementById(this.getEditInputId()).focus();
		}

		if (!prevProps.didTriggerThread && this.props.didTriggerThread) {
			this.showCode(true);
		}
	}

	handleClickCodeBlock = event => {
		event.stopPropagation();
		this.showCode();
	};

	async showCode(enteringThread = false) {
		const codeBlock = this.props.post.codeBlocks && this.props.post.codeBlocks[0];
		if (codeBlock) {
			if (codeBlock.repoId) {
				const status = await this.props.showCode(this.props.post, enteringThread);
				if (status === "SUCCESS") {
					this.setState({ warning: null });
				} else {
					this.setState({ warning: status });
				}
			} else this.setState({ warning: "NO_REMOTE" });
		}
	}

	resubmit = () => this.props.retryPost(this.props.post.id);

	cancel = () => this.props.cancelPost(this.props.post.id);

	getWarningMessage() {
		const { intl } = this.props;
		switch (this.state.warning) {
			case "NO_REMOTE": {
				const message = intl.formatMessage({
					id: "codeBlock.noRemote",
					defaultMessage: "This code does not have a remote URL associated with it."
				});
				const learnMore = intl.formatMessage({ id: "learnMore" });
				return (
					<span>
						{message}{" "}
						<a href="https://help.codestream.com/hc/en-us/articles/360013410551">{learnMore}</a>
					</span>
				);
			}
			case "FILE_NOT_FOUND": {
				return (
					<span>
						{intl.formatMessage({
							id: "codeBlock.fileNotFound",
							defaultMessage: "You don’t currently have this file in your repo."
						})}
					</span>
				);
			}
			case "REPO_NOT_IN_WORKSPACE": {
				return (
					<span>
						{intl.formatMessage(
							{
								id: "codeBlock.repoMissing",
								defaultMessage: "You don’t currently have the {repoName} repo open."
							},
							{ repoName: this.props.repoName }
						)}
					</span>
				);
			}
			case "UNKNOWN_LOCATION":
			default: {
				return (
					<span>
						{intl.formatMessage({
							id: "codeBlock.locationUnknown",
							defaultMessage: "Unknown code block location."
						})}
					</span>
				);
			}
		}
	}

	renderCode(codeBlock) {
		const path = codeBlock.file;
		let extension = Path.extname(path).toLowerCase();
		if (extension.startsWith(".")) {
			extension = extension.substring(1);
			if (extension === "tsx") extension = "jsx"; // Placeholder until https://github.com/highlightjs/highlight.js/pull/1663 get's merged
		}
		let codeHTML;
		if (extension) {
			try {
				codeHTML = hljs.highlight(extension, codeBlock.code).value;
			} catch (e) {
				/* the language for that file extension may not be supported */
				codeHTML = hljs.highlightAuto(codeBlock.code).value;
			}
		} else codeHTML = hljs.highlightAuto(codeBlock.code).value;

		return <div className="code" dangerouslySetInnerHTML={{ __html: codeHTML }} />;
	}

	render() {
		if (this.props.deactivated) return null;

		// console.log(renderCount++);
		const { post } = this.props;
		// console.log(post);
		const { menuOpen, authorMenuOpen, menuTarget } = this.state;

		const mine = post.creatorId === this.props.currentUserId;
		const systemPost = post.creatorId === "codestream";

		const postClass = createClassString({
			post: true,
			mine: mine,
			hover: menuOpen || authorMenuOpen,
			editing: this.props.editing,
			"system-post": systemPost,
			unread: this.props.unread,
			"new-separator": this.props.newMessageIndicator,
			[`thread-key-${this.props.threadKey}`]: true
		});

		let codeBlock = null;
		if (post.codeBlocks && post.codeBlocks.length) {
			let code = post.codeBlocks[0].code;
			const noRepo = !post.codeBlocks[0].repoId;
			codeBlock = (
				<div
					className="code-reference"
					onClick={this.props.showDetails && this.handleClickCodeBlock}
				>
					<div className={createClassString("header", { "no-repo": noRepo })}>
						<span className="file">{post.codeBlocks[0].file || "-"}</span>
						{this.state.warning && (
							<Tooltip placement="left" title={this.getWarningMessage()}>
								<span className="icon-wrapper">
									<Icon name="info" />
								</span>
							</Tooltip>
						)}
					</div>
					{this.renderCode(post.codeBlocks[0])}
				</div>
			);
		}

		let parentPost = this.props.replyingTo;
		if (_.isString(parentPost)) parentPost = { text: "a message" };

		let menuItems = [];

		if (!this.props.showDetails) {
			const threadLabel = parentPost || post.hasReplies ? "View Thread" : "Start a Thread";
			menuItems.push({ label: threadLabel, action: "make-thread" });
		}
		// menuItems.push({ label: "Add Reaction", action: "add-reaction" });

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
			if (this.props.canLiveshare)
				authorMenuItems.push({ label: "Invite to Live Share", action: "live-share" });
			authorMenuItems.push({ label: "Direct Message", action: "direct-message" });
		}

		const showIcons = !systemPost && !post.error;

		return (
			<div
				className={postClass}
				id={post.id}
				data-seq-num={post.seqNum}
				thread={post.parentPostId || post.id}
				ref={ref => (this._div = ref)}
			>
				{showIcons && this.renderIcons()}
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
							<span>reply to</span> <b>{(parentPost.text || "").substr(0, 80)}</b>
						</div>
					)}
					{post.creatorId === "codestream" && (
						<div className="replying-to">
							<span>only visible to you</span>
						</div>
					)}
					{codeBlock}
					{this.renderAttachments(post)}
					{this.props.showDetails &&
						!this.state.warning && (
							<PostDetails post={post} currentCommit={this.props.currentCommit} />
						)}
					{this.renderBody(post)}
					{!this.props.editing && post.hasBeenEdited && <span className="edited">(edited)</span>}
				</div>
				{this.renderReactions(post)}
			</div>
		);
	}

	renderAttachments = post => {
		if (post.files && post.files.length) {
			return post.files.map(file => {
				// console.log(file);
				//<img src={preview.url} width={preview.width} height={preview.height} />
				const { type, url, name, title, preview } = file;
				if (type === "image") {
					return (
						<div className="thumbnail">
							<a href={url}>{title}</a>
						</div>
					);
				} else if (type === "post") {
					return (
						<div className="external-post">
							<a href={url}>{title}</a>
							<div className="preview" dangerouslySetInnerHTML={{ __html: preview }} />
						</div>
					);
				} else {
					return (
						<div className="attachment">
							<a href={url}>{title}</a>
							<pre>
								<code>{preview}</code>
							</pre>
						</div>
					);
				}
			});
		}
		return null;
	};

	renderIcons = () => {
		return (
			<div className="align-right">
				<Tooltip title="Add Reaction">
					<Icon name="smiley" className="smiley" onClick={this.handleReactionClick} />
				</Tooltip>
				{this.state.emojiOpen && (
					<EmojiPicker addEmoji={this.addReaction} target={this.state.emojiTarget} />
				)}
				<Tooltip title="More Options...">
					<Icon name="gear" className="gear" onClick={this.handleMenuClick} />
				</Tooltip>
			</div>
		);
	};

	renderEmote = post => {
		let matches = (post.text || "").match(/^\/me\s+(.*)/);
		if (matches) return <span className="emote">{this.renderTextLinkified(matches[1])}</span>;
		else return null;
	};

	renderBody = post => {
		if (this.props.editing) return this.renderBodyEditing(post);
		else if ((post.text || "").match(/^\/me\s/)) return null;
		else return this.renderTextLinkified(post.text);
	};

	renderTextLinkified = text => {
		let html;
		if (text == null || text === "") {
			html = "";
		} else {
			const me = this.props.currentUserName.toLowerCase();
			html = markdownify(text).replace(/@(\w+)/g, (match, name) => {
				const nameNormalized = name.toLowerCase();
				if (this.props.userNamesNormalized.has(nameNormalized)) {
					return `<span class="at-mention${nameNormalized === me ? " me" : ""}">${match}</span>`;
				}

				return match;
			});
		}

		return <span dangerouslySetInnerHTML={{ __html: html }} />;
	};

	getEditInputId = () => {
		let id = `input-div-${this.props.post.id}`;
		if (this.props.showDetails) id = `thread-${id}`;
		return id;
	};

	renderBodyEditing = post => {
		const id = this.getEditInputId();

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
						id="cancel-button"
						className="control-button cancel"
						tabIndex="2"
						type="submit"
						loading={this.props.loading}
					>
						Cancel
					</Button>
				</div>
			</div>
		);
	};

	addReaction = emoji => {
		let { post } = this.props;

		this.setState({ emojiOpen: false });
		if (!emoji || !emoji.id) return;

		this.props.reactToPost(post, emoji.id, true);
	};

	postHasReactionFromUser = emojiId => {
		const { post, currentUserId } = this.props;
		return (
			post.reactions &&
			post.reactions[emojiId] &&
			_.contains(post.reactions[emojiId], currentUserId)
		);
	};

	toggleReaction = (emojiId, event) => {
		let { post } = this.props;

		if (event) event.stopPropagation();

		if (!emojiId) return;

		const value = this.postHasReactionFromUser(emojiId) ? false : true;
		this.props.reactToPost(post, emojiId, value);
	};

	renderReactions = post => {
		const { userNames, currentUserId } = this.props;
		const reactions = post.reactions || {};
		const keys = Object.keys(reactions);
		if (keys.length === 0) return null;
		let atLeastOneReaction = false;
		return (
			<div className="reactions">
				{keys.map(emojiId => {
					const reactors = reactions[emojiId] || [];
					if (reactors.length == 0) return null;
					const emoji = emojify(":" + emojiId + ":");
					const tooltipText =
						reactors.map(id => userNames[id]).join(", ") + " reacted with " + emojiId;
					const className = _.contains(reactors, currentUserId) ? "reaction mine" : "reaction";
					atLeastOneReaction = true;
					return (
						<Tooltip title={tooltipText} key={emojiId} placement="top">
							<div className={className} onClick={event => this.toggleReaction(emojiId, event)}>
								<span dangerouslySetInnerHTML={{ __html: emoji }} />
								{reactors.length}
							</div>
						</Tooltip>
					);
				})}
				{atLeastOneReaction && (
					<Tooltip title="Add Reaction" key="add" placement="top">
						<div className="reaction add-reaction" onClick={this.handleReactionClick}>
							<Icon name="smiley" className="smiley" onClick={this.handleReactionClick} />
						</div>
					</Tooltip>
				)}
			</div>
		);
	};

	handleMenuClick = event => {
		event.stopPropagation();
		this.setState({ menuOpen: !this.state.menuOpen, menuTarget: event.target });
	};

	handleReactionClick = event => {
		event.stopPropagation();
		this.setState({ emojiOpen: !this.state.emojiOpen, emojiTarget: event.target });
	};

	handleHeadshotClick = event => {
		event.stopPropagation();
		this.setState({ authorMenuOpen: !this.state.authorMenuOpen, menuTarget: event.target });
	};

	handleSelectMenu = action => {
		this.props.action(action, this.props.post);
		this.setState({ menuOpen: false, authorMenuOpen: false });
	};
}

const mapStateToProps = (state, props) => {
	const { users } = state;

	// TODO: figure out a way to do this elsewhere

	let index = 1;

	let userNames = {};
	let userNamesNormalized = new Set();

	for (const [userId, user] of Object.entries(users)) {
		user.color = index % 10;
		if (!user.username && user.email) {
			user.username = user.email.replace(/@.*/, "");
		}

		userNames[userId] = user.username;
		if (user.username) {
			userNamesNormalized.add(user.username.toLowerCase());
		}
	}

	const post = getPost(state.posts, props.streamId, props.id);
	if (!post) return { deactivated: true };

	const repoName =
		safe(() => {
			const codeBlock = post.codeBlocks[0];
			return getById(state.repos, codeBlock.repoId).name;
		}) || "";

	let author = users[post.creatorId];
	if (!author) {
		author = { email: "", fullName: "" };
		if (post.creatorId === "codestream") author.username = "CodeStream";
		else author.username = post.creatorId;
	}

	return {
		userNames,
		userNamesNormalized,
		repoName,
		canLiveshare: state.services.vsls,
		post: { ...post, author } // pull author out
	};
};

export default connect(
	mapStateToProps,
	{ cancelPost, retryPost, showCode, reactToPost }
)(injectIntl(Post));
