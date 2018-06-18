import React, { Fragment } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import { FormattedMessage } from "react-intl";
import EventEmitter from "../event-emitter";
import ChannelMenu from "./ChannelMenu";
import DateSeparator from "./DateSeparator";
import Icon from "./Icon";
import Post from "./Post";
import { goToInvitePage } from "../actions/routing";

class Stream extends React.Component {
	state = {
		editingPostId: null,
		menuTarget: null, // can probably replace this with a ref on <Icon/>
		openMenu: null,
		threadId: null
	};
	disposables = [];
	gearIcon = React.createRef();

	componentDidMount() {
		if (global.atom) {
			this.disposables.push(
				atom.keymaps.add("codestream", {
					"atom-workspace": {
						escape: "codestream:escape",
						"cmd-c": "codestream:copy"
					}
				}),
				atom.commands.add("atom-workspace", "codestream:escape", {
					didDispatch: event => this.handleEscape(event),
					hiddenInCommandPalette: true
				}),
				atom.commands.add("atom-workspace", "codestream:copy", {
					didDispatch: event => this.copy(event),
					hiddenInCommandPalette: true
				})
			);
		}
	}

	componentWillUnmount() {
		this.disposables.forEach(d => d.dispose());
	}

	findPostById = id => this.props.posts.find(post => post.id === id);

	handleEscape(event) {
		if (this.state.editingPostId) this.handleDismissEdit();
		else if (this.state.threadId) this.dismissThread();
		else event.abortKeyBinding();
	}

	handleClickStreamSettings = event => {
		this.setState({ openMenu: true, menuTarget: event.target });
		event.stopPropagation();
		return true;
	};

	closeMenu = () => {
		this.setState({ openMenu: false });
	};

	// by clicking on the post, we select it
	handleClickPost = event => {
		var postDiv = event.target.closest(".post");
		if (!postDiv) return;

		// if they clicked a link, follow the link rather than selecting the post
		if (event && event.target && event.target.tagName === "A") return false;

		// console.log(event.target.id);
		if (event.target.id === "discard-button") {
			// if the user clicked on the cancel changes button,
			// presumably because she is editing a post, abort
			this.setState({ editingPostId: null });
			return;
		} else if (event.target.id === "save-button") {
			// if the user clicked on the save changes button,
			// save the new post text
			let newText = document
				.getElementById("input-div-" + postDiv.id)
				.innerHTML.replace(/<br>/g, "\n");

			this.replacePostText(postDiv.id, newText);
			this.setState({ editingPostId: null });
			return;
		} else if (postDiv.classList.contains("editing")) {
			// otherwise, if we aren't currently editing the
			// post, go to the thread for that post, but if
			// we are editing, then do nothing.
			return;
		} else if (postDiv.classList.contains("system-post")) {
			// otherwise, if we aren't currently editing the
			// post, go to the thread for that post, but if
			// we are editing, then do nothing.
			return;
		} else if (window.getSelection().toString().length > 0) {
			// in this case the user has selected a string
			// by dragging
			return;
		}
		this.selectPost(postDiv.id, true);
	};

	focusInput = () => {
		const input = document.getElementById("input-div");
		if (input) input.focus();
	};

	// show the thread related to the given post, and if there is
	// a codeblock, scroll to it and select it
	selectPost = (id, wasClicked = false) => {
		EventEmitter.emit("analytics", {
			label: "Page Viewed",
			payload: { "Page Name": "Thread View" }
		});
		const post = this.props.posts.find(post => id === post.id);
		if (!post) return;

		// if it is a child in the thread, it'll have a parentPostId,
		// otherwise use the id. any post can become the head of a thread
		const threadId = post.parentPostId || post.id;
		this.setState({ threadId: threadId });

		this.focusInput();
		if (wasClicked) {
			EventEmitter.emit("interaction:thread-selected", {
				threadId,
				streamId: this.props.stream.id,
				post
			});
		}
	};

	handleClickHelpLink = event => {
		event.preventDefault();
		EventEmitter.emit("interaction:clicked-link", "https://help.codestream.com");
	};

	// dismiss the thread stream and return to the main stream
	dismissThread = ({ track = true } = {}) => {
		EventEmitter.emit("interaction:thread-closed", this.findPostById(this.state.threadId));
		this.setState({ threadId: null });
		this.focusInput();
		if (track)
			EventEmitter.emit("analytics", {
				label: "Page Viewed",
				payload: { "Page Name": "Source Stream" }
			});
	};

	handleClickGoBack = event => {
		event.preventDefault();
		this.state.threadId ? this.dismissThread() : this.props.showChannels();
	};

	renderIntro = () => {
		return [
			<label key="welcome">
				<FormattedMessage id="stream.intro.welcome" defaultMessage="Welcome to CodeStream!" />
			</label>,
			<label key="info">
				<ul>
					<li>
						<FormattedMessage
							id="stream.intro.eachFile"
							defaultMessage="Post a message and any of your teammates can join the discussion."
						/>
					</li>
					<li>
						<FormattedMessage
							id="stream.intro.comment"
							defaultMessage={
								'Comment on a specific block of code by selecting it and then clicking the "+" button.'
							}
						/>
					</li>
					<li>
						<FormattedMessage
							id="stream.intro.share"
							defaultMessage="Select &quot;Codestream: Invite&quot; from the command palette to invite your team."
						>
							{() => (
								<React.Fragment>
									Select <a onClick={this.props.goToInvitePage}>Codestream: Invite</a> from the
									command palette to invite your team.
								</React.Fragment>
							)}
						</FormattedMessage>
					</li>
				</ul>
			</label>,
			<label key="learn-more">
				Learn more at <a onClick={this.handleClickHelpLink}>help.codestream.com</a>
			</label>
		];
	};

	renderPosts = threadId => {
		let lastTimestamp = 0;
		let unread = false;

		return this.props.posts.map(post => {
			if (post.deactivated) return null;
			if (threadId && threadId !== post.parentPostId) return null;
			// this needs to be done by storing the return value of the render,
			// then setting lastTimestamp, otherwise you wouldn't be able to
			// compare the current one to the prior one.
			const parentPost = this.findPostById(post.parentPostId);
			const newMessageIndicator =
				post.seqNum && post.seqNum === Number(this.postWithNewMessageIndicator);
			unread = unread || newMessageIndicator;
			const returnValue = (
				<div key={post.id}>
					<DateSeparator timestamp1={lastTimestamp} timestamp2={post.createdAt} />
					<Post
						post={post}
						usernames={this.props.usernamesRegexp}
						currentUsername={this.props.currentUser.username}
						replyingTo={parentPost}
						newMessageIndicator={newMessageIndicator}
						unread={unread}
						editing={this.props.isActive && post.id === this.state.editingPostId}
						action={this.postAction}
					/>
				</div>
			);
			lastTimestamp = post.createdAt;
			return returnValue;
		});
	};

	render() {
		const {
			channelName,
			className,
			renderComposeBox,
			renderThread,
			runSlashCommand,
			setActivePanel,
			umis
		} = this.props;

		const umisClass = createClassString({
			mentions: umis.totalMentions > 0,
			unread: umis.totalMentions == 0 && umis.totalUnread > 0
		});
		const totalUMICount = umis.totalMentions || umis.totalUnread || "";

		const inThread = this.state.threadId;

		const threadPost = this.findPostById(this.state.threadId);

		return (
			<div className={createClassString("panel", "main-panel", "posts-panel", className)}>
				<div className="panel-header">
					<span onClick={this.handleClickGoBack} className={umisClass}>
						<Icon name="chevron-left" className="show-channels-icon align-left" />
						{totalUMICount}
					</span>
					<span>{channelName}</span>
					{this.props.stream.type !== "direct" && (
						<span onClick={this.handleClickStreamSettings}>
							<Icon name="gear" className="show-settings align-right" />
							{this.state.openMenu && (
								<ChannelMenu
									stream={this.props.stream}
									target={this.state.menuTarget}
									umiCount={0}
									isMuted={this.props.isMuted}
									setActivePanel={setActivePanel}
									runSlashCommand={runSlashCommand}
									closeMenu={this.closeMenu}
								/>
							)}
						</span>
					)}
				</div>
				<div
					className={createClassString("postslist", { shrink: inThread })}
					onClick={this.handleClickPost}
					id={`stream-${this.props.stream.id}`}
				>
					<div className="intro" ref={ref => (this._intro = ref)}>
						{this.renderIntro()}
					</div>
					{this.renderPosts()}
				</div>
				<div
					className={createClassString("postslist", "threadlist", { visible: inThread })}
					onClick={this.handleClickPost}
				>
					{threadPost && (
						<Post
							post={threadPost}
							usernames={this.props.usernamesRegexp}
							currentUsername={this.props.currentUser.username}
							key={threadPost.id}
							showDetails="1"
							currentCommit={this.props.currentCommit}
							editing={this.props.isActive && threadPost.id === this.state.editingPostId}
							action={this.postAction}
						/>
					)}
					{this.renderPosts(this.state.threadId)}
				</div>
				{renderComposeBox()}
			</div>
		);
	}
}

const mapStateToProps = state => {
	const { context, teams, users } = state;
	const teamMembers = teams[context.currentTeamId].memberIds.map(id => users[id]).filter(Boolean);

	// this usenames regexp is a pipe-separated list of
	// either usernames or if no username exists for the
	// user then his email address. it is sorted by length
	// so that the longest possible match will be made.
	const usernamesRegexp = teamMembers
		.map(user => {
			return user.username || "";
		})
		.sort(function(a, b) {
			return b.length - a.length;
		})
		.join("|")
		.replace(/\|\|+/g, "|") // remove blank identifiers
		.replace(/\+/g, "\\+") // replace + and . with escaped versions so
		.replace(/\./g, "\\."); // that the regexp matches the literal chars

	return { umis: state.umis, usernamesRegexp };
};
export default connect(
	mapStateToProps,
	{ goToInvitePage }
)(Stream);
