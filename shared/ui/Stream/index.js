import React, { Component } from "react";
import PropTypes from "prop-types";
import { injectIntl } from "react-intl";
import { connect } from "react-redux";
import createClassString from "classnames";
import ComposeBox from "./ComposeBox";
import PostList from "./PostList";
import ChannelPanel from "./ChannelPanel";
import PeoplePanel from "./PeoplePanel";
import InvitePanel from "./InvitePanel";
import PublicChannelPanel from "./PublicChannelPanel";
import CreateChannelPanel from "./CreateChannelPanel";
import ScrollBox from "./ScrollBox";
import KnowledgePanel from "./KnowledgePanel";
import InlineCodemarks from "./InlineCodemarks";
import CreateDMPanel from "./CreateDMPanel";
import ChannelMenu from "./ChannelMenu";
import Icon from "./Icon";
import Menu from "./Menu";
import CancelButton from "./CancelButton";
import Tooltip from "./Tooltip";
import OfflineBanner from "./OfflineBanner";
import * as actions from "./actions";
import { isInVscode, safe, toMapBy, arrayToRange } from "../utils";
import { getSlashCommands } from "./SlashCommands";
import { confirmPopup } from "./Confirm";
import { getPostsForStream, getPost } from "../store/posts/reducer";
import {
	getStreamForId,
	getStreamForTeam,
	getChannelStreamsForTeam,
	getDirectMessageStreamsForTeam,
	getDMName
} from "../store/streams/reducer";
import { getCodemark } from "../store/codemarks/reducer";
import { getTeamMembers } from "../store/users/reducer";
import VsCodeKeystrokeDispatcher from "../utilities/vscode-keystroke-dispatcher";
import { HostApi } from "../webview-api";
import {
	LogoutRequestType,
	LiveShareInviteToSessionRequestType,
	LiveShareStartSessionRequestType,
	WebviewDidCloseThreadNotificationType,
	WebviewDidOpenThreadNotificationType,
	HostDidChangeEditorSelectionNotificationType,
	ShowStreamNotificationType,
	HostDidChangeEditorVisibleRangesNotificationType,
	UpdateConfigurationRequestType
} from "../ipc/webview.protocol";
import {
	OpenUrlRequestType,
	SetCodemarkPinnedRequestType,
	TelemetryRequestType,
	GetRangeScmInfoRequestType
} from "@codestream/protocols/agent";
import { setCurrentStream } from "../store/context/actions";
import {
	filter as _filter,
	includes as _includes,
	last as _last,
	sortBy as _sortBy
} from "lodash-es";

const EMAIL_MATCH_REGEX = new RegExp(
	"[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*",
	"g"
);

export class SimpleStream extends Component {
	disposables = [];
	state = {
		composeBoxProps: {},
		threadTrigger: null
	};
	_compose = React.createRef();

	static contextTypes = {
		store: PropTypes.object
	};

	componentDidMount() {
		this.setUmiInfo();
		this.disposables.push(
			HostApi.instance.on(ShowStreamNotificationType, this.handleShowStream),
			HostApi.instance.on(
				HostDidChangeEditorVisibleRangesNotificationType,
				this.handleTextEditorScrolledEvent
			)
		);

		this.props.fetchCodemarks();

		// this listener pays attention to when the input field resizes,
		// presumably because the user has typed more than one line of text
		// in it, and calls a function to handle the new size
		if (this._compose.current)
			new ResizeObserver(this.handleResizeCompose).observe(this._compose.current);

		// go ahead and do resizing because some environments (VS Code) have a
		// polyfill for ResizeObserver which won't be triggered automatically
		this.handleResizeCompose();

		if (
			this.props.activePanel === "thread" &&
			this.props.postStreamId &&
			this.props.posts.length === 0
		) {
			const { postStreamId, teamId } = this.props;
			// TODO: make thread a PostList so it can be intialized properly on its own
			this.props.fetchPosts({ streamId: postStreamId, teamId, limit: 150 });
		}

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

		if (isInVscode()) {
			this.disposables.push(
				VsCodeKeystrokeDispatcher.on("keydown", event => {
					if (event.key === "Escape") {
						if (this.state.floatCompose) return this.setMultiCompose(false);
						if (event.target.id.includes("input-div-")) {
							this.handleEscape(event);
						} else if (this.state.searchBarOpen) {
							this.handleClickSearch(event);
						} else if (this.props.threadId) {
							this.handleDismissThread();
						}
					}
					if (event.key === "Enter" && !event.shiftKey && event.target.id.includes("input-div-")) {
						// save post edit
						const postId = event.target.id.split("-").pop();
						return this.editPost(postId);
					}
					if (event.key === "ArrowUp") {
						if (event.target.id === "input-div") {
							if (event.target.textContent.length === 0) {
								event.stopPropagation();
								this.editLastPost();
							}
						} else {
							event.stopPropagation();
							this.editLastPost();
						}
					}
				})
			);
		}
	}

	componentWillUnmount = () => {
		this.disposables.forEach(d => d.dispose());
		this.disposables = [];
	};

	// DEPRECATED
	handleCodeHighlightEvent = body => {
		const { composeBoxProps } = this.state;
		const { activePanel } = this.props;
		if (composeBoxProps && composeBoxProps.editingCodemark) return;
		// make sure we have a compose box to type into
		// if it's not a highlight event (i.e. someone clicked
		// "Add CodeStream Comment"), then we definitely want to
		// open multi-compose. if it is a highlight event, only
		// open it if it's not open and the user has the preference
		// to auto-open on selection

		console.log("IN HCHE: ", body);
		// if (!body.isHighlight || (!this.state.multiCompose && this.props.configs.openCommentOnSelect)) {
		// 	this.setMultiCompose(true, { quote: body });
		// }
		if (!body.isHighlight) {
			this.setMultiCompose(true, { quote: body });
		}

		if (body.isHighlight && activePanel === "inline" && !this.state.multiCompose) {
			// fixme unlighlight case
			this.setState({ openPlusOnLine: body.range.start.line });
		}
		if (
			body.isHighlight &&
			(this.newPostEntry === undefined || !this.newPostEntry.startsWith("Spatial"))
		) {
			this.setNewPostEntry("Highlighted Code");
		}
		// if multi-compose is already open, regardless of settings,
		// update this.state.quote just in case the selection changed
		if (this.state.multiCompose) this.setState({ quote: body });
	};

	handleTextEditorScrolledEvent = body => {
		console.log(body);
		this.setState({
			textEditorUri: body.uri,
			textEditorVisibleRanges: body.visibleRanges
		});
	};

	// TODO: delete this for `setThread` action
	goToThread = post => {
		const threadId = post.parentPostId || post.id;
		this.handleShowStream({ streamId: post.streamId, threadId });
	};

	handleShowStream = async ({ streamId, threadId }) => {
		if (streamId !== this.props.postStreamId) {
			console.warn("changing stream");
			this.props.setCurrentStream(streamId);
		}
		if (threadId) {
			console.warn("opening thread", threadId);
			this.openThread(threadId);
		}
	};

	copy(event) {
		let selectedText = window.getSelection().toString();
		atom.clipboard.write(selectedText);
		event.abortKeyBinding();
	}

	checkMarkStreamRead = postId => {
		// this gets called pretty often, so only ping the API
		// server if there is an actual change
		if (
			this.props.umis.unreads[this.props.postStreamId] > 0 ||
			this.props.umis.mentions[this.props.postStreamId] > 0
		) {
			// console.log("Marking within check. StreamID: ", this.props.postStreamId);
			this.props.markStreamRead(this.props.postStreamId, postId);
		}
	};

	componentDidUpdate(prevProps, prevState) {
		const { postStreamId } = this.props;

		if (this.props.activePanel === "main" && prevProps.activePanel !== "main") {
			// if we are switching from a non-main panel
			this.focusInput();
		}

		// when going in and out of threads, make sure the streams are all
		// the right height
		if (prevProps.threadId !== this.props.threadId) {
			this.resizeStream();
		}

		this.setUmiInfo(prevProps);

		const switchedStreams = postStreamId && postStreamId !== prevProps.postStreamId;
		if (switchedStreams) {
			this.onThreadClosed(prevProps.threadId);
			safe(() => this._postslist.scrollToBottom());
		}
		if (this.props.activePanel !== prevProps.activePanel && this.state.editingPostId)
			this.handleDismissEdit();
	}

	setUmiInfo(prevProps) {
		const { postStreamId, umis } = this.props;
		let lastReadSeqNum = umis.lastReads[postStreamId];
		lastReadSeqNum = lastReadSeqNum ? Number(lastReadSeqNum) : null;

		let shouldChangeState = false;
		if (prevProps) {
			const switchedStreams = postStreamId && postStreamId !== prevProps.postStreamId;
			const newUnreads = umis.unreads[postStreamId] && !prevProps.umis.unreads[postStreamId];
			if (switchedStreams || newUnreads) {
				// reset the new message line or it's moved
				shouldChangeState = true;
			}
		} else {
			shouldChangeState = true;
		}

		if (shouldChangeState)
			this.setState({
				newMessagesAfterSeqNum: lastReadSeqNum
			});
	}

	setPostsListRef = element => {
		this._postslist = element;
	};

	setThreadListRef = element => {
		this._threadpostslist = element;
	};

	handleResizeCompose = () => {
		this.resizeStream();
	};

	resizeStream = () => {};

	setNewPostEntry = entry => {
		this.newPostEntry = entry;
	};

	// return the post, if any, with the given ID
	findPostById(id) {
		const { posts } = this.context.store.getState();
		return getPost(posts, this.props.postStreamId, id);
	}

	handleClickHelpLink = () => {
		HostApi.instance.send(OpenUrlRequestType, { url: "https://help.codestream.com" });
	};

	handleClickFeedbackLink = () => {
		HostApi.instance.send(OpenUrlRequestType, {
			url: "mailto:team@codestream.com?Subject=CodeStream Feedback"
		});
	};

	renderIntro = nameElement => {
		const [first, ...rest] = this.props.channelMembers
			.filter(member => member.id !== this.props.currentUserId)
			.map(member => member.username)
			.sort();

		const localizedMembers =
			rest.length === 1
				? `${first} and ${rest[0]}`
				: rest.reduce(
						(result, string, index, array) =>
							index === array.length - 1 ? `${result}, and ${string}` : `${result}, ${string}`,
						first
				  );

		return (
			<label key="info">
				{this.props.postStream.type === "direct" ? (
					<span>This is the beginning of your direct message with {localizedMembers}.</span>
				) : (
					<span>
						This is the beginning of the <b>{nameElement}</b> channel.
					</span>
				)}
			</label>
		);
	};

	channelIcon() {
		return this.props.postStreamType === "direct" ? (
			this.props.postStreamMemberIds.length > 2 ? (
				<Icon name="organization" className="organization" />
			) : (
				<Icon name="person" />
			)
		) : this.props.isPrivate ? (
			<Icon name="lock" />
		) : (
			<span>#</span>
		);
	}

	renderMenu() {
		const { providerInfo = {} } = this.props;
		const { menuOpen, menuTarget } = this.state;
		const inviteLabel = this.props.isSlackTeam ? "Invite People to CodeStream" : "Invite People";

		const menuItems = [
			{ label: this.props.teamName, action: "" },
			{ label: "-" },
			{ label: inviteLabel, action: "invite" },
			// { label: "Settings", action: "settings" },
			{ label: "Feedback", action: "feedback" },
			{ label: "Help", action: "help" },
			{ label: "-" }
		];
		// if (providerInfo.slack)
		// 	menuItems.push({ label: "Disconnect Slack", action: "disconnect-slack" });
		// else menuItems.push({ label: "Connect to Slack", action: "connect-slack" });
		if (providerInfo.trello)
			menuItems.push({ label: "Disconnect Trello", action: "disconnect-trello" });
		else menuItems.push({ label: "Connect to Trello", action: "connect-trello" });
		if (providerInfo.github)
			menuItems.push({ label: "Disconnect GitHub", action: "disconnect-github" });
		else menuItems.push({ label: "Connect to GitHub", action: "connect-github" });
		if (providerInfo.gitlab)
			menuItems.push({ label: "Disconnect GitLab", action: "disconnect-gitlab" });
		else menuItems.push({ label: "Connect to GitLab", action: "connect-gitlab" });
		if (providerInfo.asana)
			menuItems.push({ label: "Disconnect Asana", action: "disconnect-asana" });
		else menuItems.push({ label: "Connect to Asana", action: "connect-asana" });
		if (providerInfo.jira) menuItems.push({ label: "Disconnect Jira", action: "disconnect-jira" });
		else menuItems.push({ label: "Connect to Jira", action: "connect-jira" });
		if (providerInfo.bitbucket)
			menuItems.push({ label: "Disconnect Bitbucket", action: "disconnect-bitbucket" });
		else menuItems.push({ label: "Connect to Bitbucket", action: "connect-bitbucket" });
		menuItems.push({ label: "-" });
		menuItems.push({ label: "Sign Out", action: "signout" });

		const menu = menuOpen ? (
			<Menu items={menuItems} target={menuTarget} action={this.menuAction} align="right" />
		) : null;
		return menu;
	}

	renderNavIcons() {
		const { configs, umis, postStreamPurpose, providerInfo = {} } = this.props;
		let { activePanel } = this.props;
		const { searchBarOpen, q } = this.state;
		if (searchBarOpen) activePanel = "knowledge";
		// if (searchBarOpen && q) activePanel = "knowledge";
		const umisClass = createClassString("umis", {
			mentions: umis.totalMentions > 0,
			unread: umis.totalMentions == 0 && umis.totalUnread > 0
		});
		const totalUMICount = umis.totalMentions ? (
			<div className="mentions-badge">{umis.totalMentions > 99 ? "99+" : umis.totalMentions}</div>
		) : umis.totalUnread ? (
			<div className="unread-badge" />
		) : (
			// <Icon name="chevron-left" className="show-channels-icon" />
			""
		);

		const menu = this.renderMenu();

		return (
			<nav className="inline">
				<div className="top-tab-group">
					<div className="fill-tab" onClick={e => this.setActivePanel("inline")} />
					<label
						className={createClassString({
							selected: activePanel === "inline"
						})}
						onClick={e => this.setActivePanel("inline")}
					>
						<Tooltip title="Codemarks In Current File" placement="bottom">
							<span>
								<Icon name="document" />
							</span>
						</Tooltip>
					</label>
					{
						// <label
						// 	className={createClassString({
						// 		selected: activePanel === "activity"
						// 	})}
						// 	onClick={e => this.setActivePanel("activity")}
						// >
						// 	<Tooltip title="Activity Feed" placement="bottom">
						// 		<span>
						// 			<Icon name="activity" />
						// 		</span>
						// 	</Tooltip>
						// </label>
					}
					{
						// <label
						// 	className={createClassString({
						// 		selected: activePanel === "knowledge" && this.state.knowledgeType === "question"
						// 	})}
						// 	onClick={e => this.openCodemarkMenu("question")}
						// >
						// 	<Tooltip title="Frequently Asked Questions" placement="bottom">
						// 		<span>
						// 			<Icon name="question" />
						// 		</span>
						// 	</Tooltip>
						// </label>
					}
					{
						// <label
						// 	className={createClassString({
						// 		selected: activePanel === "knowledge" && this.state.knowledgeType === "issue"
						// 	})}
						// 	onClick={e => this.openCodemarkMenu("issue")}
						// >
						// 	<Tooltip title="Issues" placement="bottom">
						// 		<span>
						// 			<Icon name="issue" />
						// 		</span>
						// 	</Tooltip>
						// </label>
						// <label
						// 	className={createClassString({
						// 		selected: activePanel === "knowledge" && this.state.knowledgeType === "trap"
						// 	})}
						// 	onClick={e => this.openCodemarkMenu("trap")}
						// >
						// 	<Tooltip title="Traps" placement="bottom">
						// 		<span>
						// 			<Icon name="trap" />
						// 		</span>
						// 	</Tooltip>
						// </label>
						// <label
						// 	className={createClassString({
						// 		selected: activePanel === "knowledge" && this.state.knowledgeType === "bookmark"
						// 	})}
						// 	onClick={e => this.openCodemarkMenu("bookmark")}
						// >
						// 	<Tooltip title="Bookmarks" placement="bottom">
						// 		<span>
						// 			<Icon name="bookmark" />
						// 		</span>
						// 	</Tooltip>
						// </label>
					}
					<label
						className={createClassString({
							selected:
								activePanel === "channels" || activePanel === "main" || activePanel === "thread"
						})}
						onClick={e => this.setActivePanel("channels")}
					>
						<Tooltip title="Channels &amp; DMs" placement="bottom">
							<span>
								{this.props.isSlackTeam ? (
									<Icon className="slack" name="slack" />
								) : (
									<Icon name="chatroom" />
								)}
								{!this.props.configs.muteAll && <span className={umisClass}>{totalUMICount}</span>}
							</span>
						</Tooltip>
					</label>
					<label
						className={createClassString({
							selected: activePanel === "knowledge"
						})}
						onClick={this.handleClickSearch}
					>
						<Tooltip title="Search Codemarks" placement="bottomRight">
							<span>
								<Icon name="search" />
							</span>
						</Tooltip>
					</label>
					<label onClick={this.handleClickNavMenu}>
						<Tooltip title="More..." placement="bottomRight">
							<span>
								<Icon onClick={this.toggleMenu} name="kebab-horizontal" />
								{this.renderMenu()}
							</span>
						</Tooltip>
					</label>
				</div>
			</nav>
		);
	}

	handleClickCreateCodemark = e => {
		e.preventDefault();
		this.setMultiCompose(true);
		this.setNewPostEntry("Global Nav");
	};

	renderNavText() {
		const { configs, umis, postStreamPurpose, providerInfo = {} } = this.props;
		let { activePanel } = this.props;
		const { searchBarOpen, q } = this.state;
		const { menuOpen, menuTarget } = this.state;
		if (searchBarOpen && q) activePanel = "knowledge";
		// const umisClass = createClassString("umis", {
		// 	// mentions: umis.totalMentions > 0,
		// 	unread: umis.totalMentions == 0 && umis.totalUnread > 0
		// });
		const totalUMICount = umis.totalMentions ? (
			<div className="mentions-badge">{umis.totalMentions > 99 ? "99+" : umis.totalMentions}</div>
		) : umis.totalUnread ? (
			<div className="unread-badge">.</div>
		) : (
			// <Icon name="chevron-left" className="show-channels-icon" />
			""
		);

		return (
			<nav className="nav">
				{this.state.searchBarOpen && (
					<div className="search-bar">
						<input
							name="q"
							className="native-key-bindings input-text control"
							type="text"
							ref={ref => (this._searchInput = ref)}
							onChange={e => this.setState({ q: e.target.value })}
							placeholder="Search Codemarks"
						/>
						<CancelButton onClick={this.handleClickSearch} />
					</div>
				)}
				{!this.state.searchBarOpen && (
					<div className="top-tab-group">
						<label
							className={createClassString({
								checked: activePanel === "knowledge" || activePanel === "inline"
								// muted: !this.props.configs.showMarkers
							})}
							onClick={e => this.setActivePanel("knowledge")}
						>
							<span>
								{!this.props.configs.showMarkers && <Icon name="mute" className="mute" />}
								Codemarks
							</span>
						</label>
						<label
							className={createClassString({
								checked: activePanel === "channels",
								muted: this.props.configs.muteAll
							})}
							onClick={e => this.setActivePanel("channels")}
						>
							<span>
								{this.props.configs.muteAll && <Icon name="mute" className="mute" />}
								Channels
								{!this.props.configs.muteAll && totalUMICount}
							</span>
						</label>
						<label
							className={createClassString("channel-name", { checked: activePanel === "main" })}
							onClick={e => this.setActivePanel("main")}
						>
							<span className="channel-name">
								{this.channelIcon()} {this.props.postStreamName}
							</span>
						</label>
						<div className="fill-tab">
							<span className="align-right-button" onClick={this.handleClickSearch}>
								<Tooltip title="Search Codemarks" placement="bottomRight">
									<span>
										<Icon name="search" className="search-icon button" />
									</span>
								</Tooltip>
							</span>
							<span className="align-right-button" onClick={this.handleClickCreateCodemark}>
								<Tooltip title="Create Codemark" placement="bottomRight">
									<span>
										<Icon name="plus" className="button" />
									</span>
								</Tooltip>
							</span>
							<span className="align-right-button" onClick={this.handleClickNavMenu}>
								<Tooltip title="More..." placement="bottomRight">
									<span>
										<Icon onClick={this.toggleMenu} name="kebab-horizontal" className="button" />
										{this.renderMenu()}
									</span>
								</Tooltip>
							</span>
						</div>
					</div>
				)}
			</nav>
		);
	}

	// we render both a main stream (postslist) plus also a postslist related
	// to the currently selected thread (if it exists). the reason for this is
	// to be able to animate between the two streams, since they will both be
	// visible during the transition
	render() {
		const { configs, umis, postStreamPurpose, providerInfo = {} } = this.props;
		let { activePanel } = this.props;
		const { searchBarOpen, q } = this.state;
		// if (searchBarOpen && q) activePanel = "knowledge";
		if (searchBarOpen) activePanel = "knowledge";

		let threadId = this.props.threadId;
		let threadPost = this.findPostById(threadId);

		const streamClass = createClassString({
			stream: true,
			"has-overlay": threadId || this.state.multiCompose || this.state.floatCompose,
			"has-floating-compose": this.state.floatCompose,
			"no-headshots": !configs.showHeadshots
		});
		const threadPostsListClass = createClassString({
			postslist: true,
			threadlist: true
		});
		const mainPanelClass = createClassString({
			panel: true,
			"main-panel": true
		});

		let placeholderText = "Comment in #" + this.props.postStreamName;
		let channelName = "#" + this.props.postStreamName;
		if (this.props.postStreamType === "direct") {
			placeholderText = "Message " + this.props.postStreamName;
			channelName = "@" + this.props.postStreamName;
		}
		if (activePanel === "thread" && threadPost) {
			placeholderText = "Reply to " + threadPost.author.username;
			channelName = "Reply to " + threadPost.author.username;
		}

		const streamDivId = "stream-" + this.props.postStreamId;

		const unreadsAboveClass = createClassString({
			unreads: true,
			active: this.state.unreadsAbove
		});
		const unreadsBelowClass = createClassString({
			unreads: true,
			// offscreen: activePanel === "main",
			active: this.state.unreadsBelow && activePanel === "main"
		});

		const channelIcon =
			this.props.postStreamType === "direct" ? (
				this.props.postStreamMemberIds.length > 2 ? (
					<Icon name="organization" className="organization" />
				) : (
					<Icon name="person" />
				)
			) : this.props.isPrivate ? (
				<Icon name="lock" />
			) : (
				<span>#</span>
			);
		const menuActive = this.props.postStreamId && this.state.openMenu === this.props.postStreamId;

		// 	<span className="open-menu">
		// 	<Icon name="triangle-down" />
		// </span>

		const memberCount = (this.props.postStreamMemberIds || []).length;
		const lower = threadPost ? threadPost.type || "Comment" : "";
		const commentTypeLabel = lower.charAt(0).toUpperCase() + lower.substr(1);
		const postStreamStarred = this.props.starredStreams[this.props.postStreamId];
		const closeThreadTooltip = (
			<span>
				Close thread <span className="keybinding">ESC</span>
			</span>
		);

		const textEditorVisibleRanges =
			this.state.textEditorVisibleRanges || this.props.textEditorVisibleRanges;
		const textEditorUri = this.state.textEditorUri || this.props.textEditorUri;

		// these panels do not have global nav
		let renderNav = !["create-channel", "create-dm", "public-channels", "invite"].includes(
			activePanel
		);
		if (this.state.floatCompose) renderNav = false;

		return (
			<div className={streamClass}>
				<div id="modal-root" />
				<div id="confirm-root" />
				<div id="focus-trap" className={createClassString({ active: !this.props.hasFocus })} />
				{(threadId || this.state.floatCompose) && <div id="panel-blanket" />}
				{renderNav && this.renderNavIcons()}
				{this.state.floatCompose && this.renderComposeBox(placeholderText, channelName)}
				<div className="content vscroll inline">
					{activePanel === "inline" && (
						<InlineCodemarks
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							usernames={this.props.usernamesRegexp}
							currentUserId={this.props.currentUserId}
							currentUserName={this.props.currentUserName}
							postAction={this.postAction}
							searchBarOpen={this.state.searchBarOpen}
							setNewPostEntry={this.setNewPostEntry}
							setMultiCompose={this.setMultiCompose}
							typeFilter="all"
							textEditorUri={textEditorUri}
							textEditorVisibleRanges={textEditorVisibleRanges}
							openPlusOnLine={this.state.openPlusOnLine}
							focusInput={this.focusInput}
							scrollDiv={this._contentScrollDiv}
						/>
					)}
					{activePanel === "knowledge" && (
						<KnowledgePanel
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							usernames={this.props.usernamesRegexp}
							currentUserId={this.props.currentUserId}
							currentUserName={this.props.currentUserName}
							postAction={this.postAction}
							searchBarOpen={this.state.searchBarOpen}
							setMultiCompose={this.setMultiCompose}
							typeFilter={this.state.knowledgeType}
						/>
					)}
					{activePanel === "channels" && (
						<ChannelPanel
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							setKnowledgeType={this.setKnowledgeType}
							setMultiCompose={this.setMultiCompose}
							runSlashCommand={this.runSlashCommand}
							isSlackTeam={this.props.isSlackTeam}
							services={this.props.services}
						/>
					)}

					{activePanel === "public-channels" && (
						<PublicChannelPanel
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							isSlackTeam={this.props.isSlackTeam}
						/>
					)}
					{activePanel === "create-channel" && (
						<CreateChannelPanel
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							isSlackTeam={this.props.isSlackTeam}
						/>
					)}
					{activePanel === "create-dm" && (
						<CreateDMPanel activePanel={activePanel} setActivePanel={this.setActivePanel} />
					)}
					{activePanel === "invite" && (
						<InvitePanel
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							isSlackTeam={this.props.isSlackTeam}
						/>
					)}
					{activePanel === "people" && (
						<PeoplePanel
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							isSlackTeam={this.props.isSlackTeam}
						/>
					)}
					{activePanel === "main" && (
						<div className={mainPanelClass}>
							{
								<div className="panel-header channel-name">
									<CancelButton onClick={this.props.closePanel} />
									<span className="channel-icon">{channelIcon}</span>
									{this.props.postStreamName}
									<span className="align-left-button" onClick={this.props.closePanel}>
										<Tooltip title="Show Channel List" placement="right">
											<span>
												<Icon name="chevron-left" className="clickable" />
											</span>
										</Tooltip>
									</span>
								</div>
							}
							<div className="filters">
								<span className="align-right-button" onClick={this.handleClickStreamSettings}>
									<Tooltip title="Channel Settings" placement="left">
										<span>
											<Icon name="gear" className="show-settings clickable" />
										</span>
									</Tooltip>
									{menuActive && (
										<ChannelMenu
											stream={this.props.postStream}
											target={this.state.menuTarget}
											umiCount={0}
											isMuted={this.props.mutedStreams[this.props.postStreamId]}
											setActivePanel={this.setActivePanel}
											runSlashCommand={this.runSlashCommand}
											closeMenu={this.closeMenu}
										/>
									)}
								</span>
								<div className="stream-header-buttons">
									<Tooltip title="Star this channel" placement="bottomLeft">
										<span className="clickable" onClick={this.starChannel}>
											<Icon
												name="star"
												className={createClassString("smaller", {
													checked: postStreamStarred
												})}
											/>
										</span>
									</Tooltip>
									{memberCount > 2 && [
										<div className="sep" key="one" />,
										<Tooltip title="View member list" placement="bottomLeft" key="two">
											<span
												className="clickable"
												style={{ whiteSpace: "nowrap" }}
												onClick={e => this.runSlashCommand("who")}
											>
												<Icon name="person" className="smaller" /> {memberCount}
											</span>
										</Tooltip>
									]}
									{
										// <div className="sep" />
										// <Tooltip title="View pinned items" placement="bottomLeft">
										// 	<span className="clickable" onClick={this.showPinnedPosts}>
										// 		<Icon name="pin" className="smaller" />
										// 	</span>
										// </Tooltip>
									}
									{postStreamPurpose && [
										<div className="sep" />,
										<span onClick={() => this.setPurpose()} className="purpose-header">
											{postStreamPurpose}
										</span>
									]}
								</div>
							</div>
							<OfflineBanner />
							<div className="shadow-overlay">
								<div className={unreadsAboveClass} type="above" onClick={this.handleClickUnreads}>
									&uarr; Unread Messages &uarr;
								</div>
								<div className={unreadsBelowClass} type="below" onClick={this.handleClickUnreads}>
									&darr; Unread Messages &darr;
								</div>
								<div style={{ height: "100%" }} onClick={this.handleClickPost} id={streamDivId}>
									<ScrollBox>
										<PostList
											ref={this.setPostsListRef}
											isActive={this.props.activePanel === "main"}
											hasFocus={this.props.hasFocus}
											newMessagesAfterSeqNum={this.state.newMessagesAfterSeqNum}
											usernamesRegexp={this.props.usernamesRegexp}
											teammates={this.props.teammates}
											currentUserId={this.props.currentUserId}
											currentUserName={this.props.currentUserName}
											editingPostId={this.state.editingPostId}
											postAction={this.postAction}
											onDidChangeVisiblePosts={this.handleDidChangeVisiblePosts}
											streamId={this.props.postStreamId}
											teamId={this.props.teamId}
											markRead={this.checkMarkStreamRead}
											renderIntro={() => (
												<div className="intro" ref={ref => (this._intro = ref)}>
													{this.renderIntro(
														<span>
															{channelIcon}
															{this.props.postStreamName}
														</span>
													)}
												</div>
											)}
										/>
									</ScrollBox>
								</div>
							</div>
							{!threadId &&
								activePanel === "main" &&
								!this.state.floatCompose &&
								this.renderComposeBox(placeholderText, channelName)}
						</div>
					)}
					{threadId && (
						<div className="thread-panel" ref={ref => (this._threadPanel = ref)}>
							<div className="panel-header inline">
								<CancelButton title={closeThreadTooltip} onClick={this.handleDismissThread} />
								<span>
									<label>
										{commentTypeLabel} in{" "}
										<span className="clickable" onClick={() => this.handleDismissThread()}>
											{channelIcon}
											{this.props.postStreamName}
										</span>
									</label>
								</span>
							</div>
							<OfflineBanner />
							<div className="shadow-overlay">
								<div className={threadPostsListClass} onClick={this.handleClickPost}>
									<ScrollBox>
										<PostList
											ref={this.setThreadListRef}
											isActive={this.props.activePanel === "thread"}
											hasFocus={this.props.hasFocus}
											usernamesRegexp={this.props.usernamesRegexp}
											teammates={this.props.teammates}
											currentUserId={this.props.currentUserId}
											currentUserName={this.props.currentUserName}
											editingPostId={this.state.editingPostId}
											postAction={this.postAction}
											streamId={this.props.postStreamId}
											isThread
											threadId={threadId}
											threadTrigger={this.state.threadTrigger}
											teamId={this.props.teamId}
										/>
									</ScrollBox>
								</div>
							</div>
							{!this.state.floatCompose && this.renderComposeBox(placeholderText, channelName)}
						</div>
					)}
				</div>
			</div>
		);
	}

	renderComposeBox = (placeholderText, channelName) => {
		const textEditorVisibleRanges =
			this.state.textEditorVisibleRanges || this.props.textEditorVisibleRanges;

		return (
			<ComposeBox
				placeholder={placeholderText}
				channelName={channelName}
				teammates={this.props.teammates}
				slashCommands={this.props.slashCommands}
				channelStreams={this.props.channelStreams}
				directMessageStreams={this.props.directMessageStreams}
				streamId={this.props.postStreamId}
				services={this.props.services}
				currentUserId={this.props.currentUserId}
				ensureStreamIsActive={this.ensureStreamIsActive}
				ref={this._compose}
				disabled={this.props.isOffline}
				onSubmitPost={this.submitPlainPost}
				onSubmitCodemark={this.submitCodemark}
				onSubmit={this.submitPost}
				onEmptyUpArrow={this.editLastPost}
				findMentionedUserIds={this.findMentionedUserIds}
				isDirectMessage={this.props.postStreamType === "direct"}
				isSlackTeam={this.props.isSlackTeam}
				multiCompose={this.state.multiCompose}
				floatCompose={this.state.floatCompose}
				setMultiCompose={this.setMultiCompose}
				quote={this.state.quote}
				openCommentOnSelect={this.props.configs.openCommentOnSelect}
				toggleOpenCommentOnSelect={this.toggleOpenCommentOnSelect}
				quotePost={this.state.quotePost}
				inThread={Boolean(this.props.threadId)}
				providerInfo={this.props.providerInfo}
				fetchIssueBoards={this.props.fetchIssueBoards}
				createTrelloCard={this.props.createTrelloCard}
				textEditorVisibleRanges={textEditorVisibleRanges}
				setNewPostEntry={this.setNewPostEntry}
				{...this.state.composeBoxProps}
			/>
		);
	};

	menuAction = arg => {
		this.setState({ menuOpen: false });
		// if (arg) this.setCommentType(arg);
		switch (arg) {
			case "invite":
				return this.setActivePanel("invite");
			case "help":
				return this.handleClickHelpLink();
			case "feedback":
				return this.handleClickFeedbackLink();
			// case "connect-slack":
			// 	return this.props.connectSlack();
			// case "disconnect-slack":
			case "connect-trello":
				return this.props.connectService("trello");
			case "disconnect-trello":
				return this.props.disconnectService("trello");
			case "connect-asana":
				return this.props.connectService("asana");
			case "disconnect-asana":
				return this.props.disconnectService("asana");
			case "connect-github":
				return this.props.connectService("github");
			case "disconnect-github":
				return this.props.disconnectService("github");
			case "connect-gitlab":
				return this.props.connectService("gitlab");
			case "disconnect-gitlab":
				return this.props.disconnectService("gitlab");
			case "connect-jira":
				return this.props.connectService("jira");
			case "disconnect-jira":
				return this.props.disconnectService("jira");
			case "connect-bitbucket":
				return this.props.connectService("bitbucket");
			case "disconnect-bitbucket":
				return this.props.disconnectService("bitbucket");
			case "signout":
				return HostApi.instance.send(LogoutRequestType, {});

			default:
				return;
		}
	};

	toggleMenu = event => {
		this.setState({ menuOpen: !this.state.menuOpen, menuTarget: event.target });
	};

	openCodemarkMenu = type => {
		this.setState({ knowledgeType: type, searchBarOpen: false });
		this.setActivePanel("knowledge");
	};

	toggleOpenCommentOnSelect = () => {
		HostApi.instance.send(UpdateConfigurationRequestType, {
			name: "openCommentOnSelect",
			value: !this.props.configs.openCommentOnSelect
		});
	};

	starChannel = () => {
		const { starredStreams, postStreamId } = this.props;
		const starred = starredStreams[postStreamId];
		this.props.setUserPreference(["starredStreams", postStreamId], !starred);
		// this.setState({ postChannelStarred: !this.state.postChannelStarred });
	};

	showPinnedPosts = () => {
		return this.notImplementedYet();
	};

	handleClickSearch = e => {
		if (e) e.stopPropagation();

		const { searchBarOpen } = this.state;
		if (searchBarOpen) {
			this.setState({ q: null });
		}
		this.setActivePanel("knowledge");
		// this.setState({ searchBarOpen: !searchBarOpen, knowledgeType: "all" });
	};

	setContentScrollTop = value => {
		this._contentScrollDiv.scrollTop = value;
	};

	getContentScrollTop = () => {
		return this._contentScrollDiv.scrollTop;
	};

	setMultiCompose = (value, state = {}) => {
		// ugly hack -Pez
		if (value == "collapse") {
			this.setState({ multiCompose: false, ...state });
		} else {
			this.setState({ multiCompose: value, floatCompose: true, ...state });
			if (!value) {
				this.setNewPostEntry(undefined);
				this.setState({
					quote: null,
					floatCompose: false,
					composeBoxProps: {}
				});
			}
		}
		// if (value) this.focus();
	};

	setKnowledgeType = type => {
		this.setState({ knowledgeType: type, searchBarOpen: false });
	};

	handleClickStreamSettings = event => {
		this.setState({ openMenu: this.props.postStreamId, menuTarget: event.target });
		event.stopPropagation();
		return true;
	};

	closeMenu = () => {
		this.setState({ openMenu: null });
	};

	findMyPostBeforeSeqNum(seqNum) {
		const me = this.props.currentUserName;
		return _last(
			_filter(this.props.posts, post => post.author.username === me && post.seqNum < seqNum)
		);
	}

	// this is no longer specific to the last post
	editLastPost = id => {
		const { activePanel } = this.props;
		let list;
		if (activePanel === "thread") list = this._threadpostslist;
		if (activePanel === "main") {
			list = this._postslist;
		}
		id = id || list.getUsersMostRecentPost().id;
		if (id) {
			const { codemarks } = this.context.store.getState();

			const post = this.findPostById(id);

			if (post.codemarkId) {
				const codemark = getCodemark(codemarks, post.codemarkId);
				const marker = codemark.markers[0];

				this.setMultiCompose(true, {
					quote: marker
						? { ...marker, range: arrayToRange(marker.location || marker.locationWhenCreated) }
						: null,
					composeBoxProps: {
						...this.state.composeBoxProps,
						key: Math.random().toString(),
						isEditing: true,
						editingCodemark: codemark
					}
				});
			} else
				this.setState({ editingPostId: post.id }, () => {
					list.scrollTo(post.id);
				});
		}
	};

	showChannels = _event => {
		this.setActivePanel("channels");
	};

	setActivePanel = panel => {
		// this.setState({ searchBarOpen: false });
		this.props.openPanel(panel);
	};

	handleDidChangeVisiblePosts = data => {
		const { unreadsAbove, unreadsBelow } = this.state;
		if (unreadsAbove !== data.unreadsAbove || unreadsBelow !== data.unreadsBelow) {
			this.setState(data);
		}
	};

	handleClickUnreads = _event => {
		this._postslist && this._postslist.scrollToUnread();
	};

	scrollPostsListToBottom = () => {
		this._postslist && this._postslist.scrollToBottom();
	};

	// dismiss the thread stream and return to the main stream
	handleDismissThread = ({ track = true } = {}) => {
		this.onThreadClosed(this.props.threadId);
		this.setState({ threadTrigger: null });
		this.props.setThread(this.props.postStreamId);
		// this.setActivePanel("main");
		this.focusInput();
	};

	onThreadClosed = threadId => HostApi.instance.notify(WebviewDidCloseThreadNotificationType);

	handleEditPost = event => {
		var postDiv = event.target.closest(".post");
		if (!postDiv) return;
		this.setState({ editingPostId: postDiv.id });
	};

	handleDeletePost = event => {
		var postDiv = event.target.closest(".post");
		if (!postDiv || !postDiv.id) return;
		this.confirmDeletePost(postDiv.id);
	};

	confirmDeletePost = postId => {
		confirmPopup({
			title: "Are you sure?",
			message: "Deleting a post cannot be undone.",
			centered: true,
			buttons: [
				{
					label: "Delete Post",
					wait: true,
					action: () => this.props.deletePost(this.props.postStreamId, postId)
				},
				{ label: "Cancel" }
			]
		});
	};

	markUnread = postId => {
		this.props.markPostUnread(this.props.postStreamId, postId);
	};

	togglePinned = post => {
		if (!post) return;
		const codemark = post.codemark;
		if (!codemark) return;

		HostApi.instance.send(SetCodemarkPinnedRequestType, {
			codemarkId: codemark.id,
			value: !codemark.pinned
		});
	};

	// this tells the composebox to insert quoted text
	quotePost = post => {
		this.setState({ quotePost: post });
	};

	notImplementedYet = () => {
		return this.submitSystemPost("Not implemented yet");
	};

	invitePerson = args => {
		let email;

		if (this.props.isSlackTeam) {
			const message = `Invite your teammates to give CodeStream a try by sharing this URL with them:\n\nhttps://app.codestream.com/invite?service=slack&amp;team=${
				this.props.teamId
			}`;
			return this.submitSystemPost(message);
		} else {
			let invitedEmails = [];
			while ((email = EMAIL_MATCH_REGEX.exec(args)) !== null) {
				this.props.invite({ email: email[0], teamId: this.props.teamId });
				invitedEmails.push(email[0]);
			}
			let invited = "";
			switch (invitedEmails.length) {
				case 0:
					return this.submitSystemPost("Usage: /invite [email address]");
				case 1:
					invited = invitedEmails[0];
					break;
				default: {
					const lastOne = invitedEmails.pop();
					invited = invitedEmails.join(", ") + " and " + lastOne;
				}
			}
			return this.submitSystemPost("Invited " + invited);
		}
	};

	postAction = (action, post, args) => {
		switch (action) {
			case "make-thread":
				return this.selectPost(post.id, true);
			case "goto-thread":
				return this.goToThread(post);
			case "edit-post":
				return this.editLastPost(post.id);
			case "delete-post":
				return this.confirmDeletePost(post.id);
			case "mark-unread":
				return this.markUnread(post.id);
			case "quote":
				return this.quotePost(post);
			case "add-reaction":
				return this.notImplementedYet();
			case "pin-to-stream":
				return this.notImplementedYet();
			case "toggle-pinned":
				return this.togglePinned(post);
			case "direct-message":
				return this.sendDirectMessage(post.author.username);
			case "live-share":
				return this.inviteToLiveShare(post.creatorId);
			case "edit-headshot":
				return this.headshotInstructions(post.author.email);
			case "submit-post":
				return this.submitPost(args);
		}
	};

	headshotInstructions = email => {
		const message =
			"Until we have built-in CodeStream headshots, you can edit your headshot by setting it up on Gravatar.com for " +
			email +
			".\n\nNote that it might take a few minutes for your headshot to appear here.";

		this.submitSystemPost(message);
	};

	findMentionedUserIds = (text, users) => {
		const mentionedUserIds = [];
		users.forEach(user => {
			const matcher = user.username.replace(/\+/g, "\\+").replace(/\./g, "\\.");
			if (text.match("@" + matcher + "\\b")) {
				mentionedUserIds.push(user.id);
			}
		});
		return mentionedUserIds;
	};

	replacePostText = (postId, newText) => {
		// convert the text to plaintext so there is no HTML
		const doc = new DOMParser().parseFromString(newText, "text/html");
		const replaceText = doc.documentElement.textContent;
		const mentionUserIds = this.findMentionedUserIds(replaceText, this.props.teammates);

		this.props.editPost(this.props.postStreamId, postId, replaceText, mentionUserIds);
	};

	editPost = id => {
		let inputId = `input-div-${id}`;
		if (this.props.threadId) inputId = `thread-${inputId}`;
		let newText = document.getElementById(inputId).innerHTML.replace(/<br>/g, "\n");

		this.replacePostText(id, newText);
		this.setState({ editingPostId: null });
	};

	// by clicking on the post, we select it
	handleClickPost = event => {
		var postDiv = event.target.closest(".post");
		if (!postDiv) return;

		// if they clicked a link, follow the link rather than selecting the post
		if (event && event.target && event.target.tagName === "A") return false;

		// console.log(event.target.id);
		if (event.target.id === "cancel-button") {
			// if the user clicked on the cancel changes button,
			// presumably because she is editing a post, abort
			this.setState({ editingPostId: null });
			return;
		} else if (event.target.id === "save-button") {
			// if the user clicked on the save changes button,
			// save the new post text
			return this.editPost(postDiv.id);
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

	// show the thread related to the given post
	selectPost = (id, wasClicked) => {
		const post = this.findPostById(id);
		if (!post) return;

		// if it is a child in the thread, it'll have a parentPostId,
		// otherwise use the id. any post can become the head of a thread
		const threadId = post.parentPostId || post.id;
		this.openThread(threadId, wasClicked);

		if (wasClicked && post.codemark && !this.props.threadId) {
			HostApi.instance.send(TelemetryRequestType, {
				eventName: "Codemark Clicked",
				properties: {
					"Codemark Location": "Stream"
				}
			});
		}
	};

	openThread = (threadId, wasClicked = false) => {
		this.setState({ threadTrigger: wasClicked && threadId });
		this.props.setThread(this.props.postStreamId, threadId);
		// this.setActivePanel("thread");

		this.focusInput();
		if (wasClicked) {
			HostApi.instance.notify(WebviewDidOpenThreadNotificationType, {
				threadId,
				streamId: this.props.postStreamId
			});
		}
	};

	// not using a gutter for now
	// installGutter() {
	// 	let editor = atom.workspace.getActiveTextEditor();
	// 	if (editor && !editor.gutterWithName("CodeStream")) {
	// 		editor.addGutter({ name: "CodeStream", priority: 150 });
	// 	}
	// }

	focusInput = () => {
		console.log("IN FOCUS INPUT");
		setTimeout(() => {
			const input = document.getElementById("input-div");
			if (input) input.focus();
		}, 20);
	};

	handleEscape(event) {
		if (this.state.editingPostId) this.handleDismissEdit();
		else if (this.state.searchBarOpen) this.handleClickSearch(event);
		else if (this.props.activePanel === "thread") this.handleDismissThread();
		else event.abortKeyBinding();
	}

	handleDismissEdit() {
		this.setState({ editingPostId: null });
		this.focusInput();
	}

	// return true if we are able to use substitute
	// to edit the text of my last post
	substituteLastPost(substitute) {
		// nothing to substitute? return false
		if (!substitute) return false;

		// if we can't find my last post in the stream, return false
		const myLastPost = this.findMyPostBeforeSeqNum(9999999999);
		if (!myLastPost) return false;

		const find = substitute[1];
		const replace = substitute[2];
		// const modifier = substitute[3]; // not used yet
		const newText = myLastPost.text.replace(find, replace);
		if (newText !== myLastPost.text) {
			this.replacePostText(myLastPost.id, newText);
			return true;
		} else return false;
	}

	toggleMute = () => {
		const { postStreamId, postStreamType } = this.props;

		if (postStreamType === "direct") {
			const text = "You cannot mute direct message streams. Close them on the Channels list page.";
			return this.submitSystemPost(text);
		}

		const isMuted = this.props.mutedStreams[postStreamId];
		this.props.changeStreamMuteState(postStreamId, !isMuted);
		const text = isMuted ? "This stream has been unmuted." : "This stream has been muted.";
		return this.submitSystemPost(text);
	};

	showMembers = () => {
		const memberIds = this.props.postStreamMemberIds;
		const streamName =
			this.props.postStreamType === "direct" ? "this DM" : this.props.postStreamName;

		let names = [];
		const teammates = this.props.teammates.filter(({ id }) => id !== this.props.currentUserId);

		if (this.props.postStreamIsTeamStream) {
			teammates.map(user => {
				names.push(user.username);
			});
		} else {
			teammates.map(user => {
				if (_includes(memberIds, user.id)) names.push(user.username);
			});
		}
		names = _sortBy(names, name => name.toLowerCase());

		let text;
		if (names.length === 0) text = "You are the only member in " + streamName;
		else if (names.length === 1)
			text = "Members in " + streamName + " are you and @" + names[0] + ".";
		else {
			text = "Members in " + streamName + " are @" + names.join(", @") + " and you.";
		}

		if (this.props.postStreamIsTeamStream) {
			text +=
				"\n\nThis is an all-hands channel, so every member of your team is automatically added.";
		}

		return this.submitSystemPost(text);
	};

	extractUsersFromArgs = (args = "") => {
		const { teamMembersById } = this.props;
		let users = [];
		let usernamesArray = [];
		let rest = "";
		args
			.toLowerCase()
			.split(/(\s+)/)
			.map(token => {
				let found = false;
				Object.keys(teamMembersById).map(userId => {
					const username = teamMembersById[userId].username.toLowerCase();
					if (token === username || token === "@" + username) {
						users.push(userId);
						usernamesArray.push("@" + username);
						found = true;
					}
				});
				if (!found) rest += token;
			});
		let usernames = "";
		if (usernamesArray.length === 1) usernames = usernamesArray[0];
		else if (usernamesArray.length > 1) {
			const lastOne = usernamesArray.pop();
			usernames = usernamesArray.join(", ") + " and " + lastOne;
		}
		return { users, usernames, rest };
	};

	addMembersToStream = async args => {
		const { users, usernames } = this.extractUsersFromArgs(args);
		if (this.props.postStreamIsTeamStream) {
			const text =
				"This is an all-hands channel, so every member of your team is automatically added. To invite somone new to the team use the /invite command.";
			return this.submitSystemPost(text);
		}
		if (this.props.postStreamType === "direct") {
			const text =
				"You cannot add people to direct message streams. Create a larger conversation by clicking DIRECT MESSAGES from the channels panel.";
			return this.submitSystemPost(text);
		}
		if (users.length === 0) {
			return this.submitSystemPost("Add members to this channel by typing\n`/add @nickname`");
		} else {
			await this.props.addUsersToStream(this.props.postStreamId, users);
			if (!this.props.isSlackTeam) {
				return this.submitPost({ text: "/me added " + usernames });
			}
		}
	};

	renameChannel = async args => {
		if (this.props.postStreamType === "direct") {
			const text = "You cannot rename a direct message stream.";
			return this.submitSystemPost(text);
		}
		if (args) {
			const oldName = this.props.postStreamName;
			const { payload: newStream } = await this.props.renameStream(this.props.postStreamId, args);
			if (newStream && newStream.name === args) {
				if (!this.props.isSlackTeam) {
					this.submitPost({ text: "/me renamed the channel from #" + oldName + " to #" + args });
				}
			} else
				this.submitSystemPost(
					"Unable to rename channel. Channel names must be unique. CodeStream doesn't support these characters: .~#%&*{}+/:<>?|'\"."
				);
		} else this.submitSystemPost("Rename a channel by typing `/rename [new name]`");
		return true;
	};

	printSlackInstructions = async _args => {
		const { configs, intl } = this.props;
		const message =
			intl.formatMessage({ id: "slackInfo.p1" }) +
			"\n\n" +
			intl.formatMessage({ id: "slackInfo.p2" });
		confirmPopup({
			title: "Slack Integration",
			message,
			buttons: [
				{
					label: "Add to Slack",
					uri: `${configs.serverUrl}/no-auth/slack/addtoslack?codestream_team=${this.props.teamId}`
				},
				{ label: "Cancel" }
			]
		});
		return true;
	};

	setPurpose = async args => {
		if (this.props.postStreamType === "direct") {
			const text = "You cannot set a purpose in direct message streams.";
			return this.submitSystemPost(text);
		}
		if (args) {
			const { payload: newStream } = await this.props.setPurpose(this.props.postStreamId, args);
			if (newStream.purpose === args) {
				if (!this.props.isSlackTeam) {
					this.submitPost({ text: "/me set the channel purpose to " + args });
				}
			} else this.submitSystemPost("Unable to set channel purpose.");
		} else this.submitSystemPost("Set a channel purpose by typing `/purpose [new purpose]`");
		return true;
	};

	leaveChannel = () => {
		if (this.props.postStreamIsTeamStream) {
			const text = "You cannot leave all-hands channels.";
			return this.submitSystemPost(text);
		}
		const message = this.props.isPrivate
			? "Once you leave a private channel, you won't be able to re-join unless you are added by someone in the channel."
			: "Once you leave a public channel, you may re-join it in the future by looking at CHANNELS YOU CAN JOIN; click the 'Browse all Channels' icon to the right of CHANNELS on the channel panel.";
		confirmPopup({
			title: "Are you sure?",
			message,
			buttons: [
				{
					label: "Leave",
					wait: true,
					action: this.executeLeaveChannel
				},
				{ label: "Cancel" }
			]
		});
		return true;
	};

	executeLeaveChannel = async () => {
		await this.props.leaveChannel(this.props.postStreamId);
		return true;
	};

	deleteChannel = () => {
		this.setActivePanel("channels");
		return true;
	};

	archiveChannel = () => {
		const { postStream, currentUserId, teamMembersById } = this.props;
		if (postStream.creatorId !== currentUserId) {
			let text = "You may only archive channels that you created.";
			if (postStream.creatorId) {
				const creator = teamMembersById[postStream.creatorId];
				if (creator) text += " This channel was created by @" + creator.username;
			}
			return this.submitSystemPost(text);
		}
		if (this.props.postStreamType === "direct") {
			const text =
				"You cannot archive direct message streams. You can remove them from your list by clicking the X on the channels panel.";
			return this.submitSystemPost(text);
		}
		confirmPopup({
			title: "Are you sure?",
			message: "Archived channels can be found on the channels list under TEAM CHANNELS.",
			buttons: [
				{
					label: "Archive",
					action: this.executeArchiveChannel
				},
				{ label: "Cancel" }
			]
		});

		return true;
	};

	executeArchiveChannel = () => {
		const { postStream } = this.props;
		// console.log("Calling archive channel with: ", postStream.id);
		this.props.archiveStream(postStream.id, true);
		this.setActivePanel("channels");
	};

	removeFromStream = async args => {
		if (this.props.postStreamIsTeamStream) {
			const text = "You cannot remove people from all-hands channels.";
			return this.submitSystemPost(text);
		}
		if (this.props.postStreamType === "direct") {
			const text = "You cannot remove people from direct message streams.";
			return this.submitSystemPost(text);
		}
		const { users, usernames } = this.extractUsersFromArgs(args);
		if (users.length === 0) {
			this.submitSystemPost("Usage: `/remove @user`");
		} else {
			await this.props.removeUsersFromStream(this.props.postStreamId, users);
			if (!this.props.isSlackTeam) {
				this.submitPost({ text: "/me removed " + usernames });
			}
		}
		return true;
	};

	openStream = _args => {
		// getChannelStreamsForTeam(streams, context.currentTeamId, session.userId) || [],
	};

	sendDirectMessage = async args => {
		const { teamMembersById } = this.props;

		const match = /(\w+)\s+(.*)/.exec(args);

		let user;
		let mention;
		let text;
		if (match != null) {
			[, mention, text] = match;

			if (mention.startsWith("@")) {
				mention = mention.substr(1);
			}
			user = Object.values(teamMembersById).find(user => mention === user.username);
		}

		if (!user) return this.submitSystemPost("Usage: `/msg @user message`");

		// find or create the stream, then select it, then post the message
		const stream = await this.props.createStream({ type: "direct", memberIds: [user.id] });
		if (stream && (stream._id || stream.id) && text != null && text.length) {
			this.submitPost({ text: text });
		}
		return true;
	};

	submitSystemPost = async text => {
		const { postStreamId, createSystemPost, posts } = this.props;
		const threadId = this.props.threadId;
		const lastPost = _last(posts);
		const seqNum = lastPost ? lastPost.seqNum + 0.001 : 0.001;
		await createSystemPost(postStreamId, threadId, text, seqNum);
		safe(() => this._postslist.scrollToBottom());
		return true;
	};

	multiCompose = () => {};

	postHelp = () => {
		const text = "Get more help at help.codestream.com";
		this.submitSystemPost(text);
		return true;
	};

	postNotAllowedInDirectStreams = command => {
		const text = "`/" + command + "` not allowed in direct message streams.";
		this.submitSystemPost(text);
		return true;
	};

	postVersion = () => {
		const text = `This is CodeStream version ${this.props.pluginVersion}.`;
		this.submitSystemPost(text);
		return true;
	};

	inviteToLiveShare = userId => {
		HostApi.instance.send(TelemetryRequestType, {
			eventName: "Start Live Share",
			properties: {
				"Start Location": "Headshot"
			}
		});

		HostApi.instance.send(LiveShareInviteToSessionRequestType, { userId, createNewStream: false });
		return true;
	};

	startLiveShare = args => {
		const { startLocation } = args;
		console.log("Start location : " + startLocation);
		let liveShareStartLocation = "Slash Command";
		if (startLocation != null) {
			liveShareStartLocation = startLocation;
		}
		const { postStreamId } = this.props;
		const threadId = this.props.threadId;

		const text = "Starting Live Share...";
		this.submitSystemPost(text);

		HostApi.instance.send(TelemetryRequestType, {
			eventName: "Start Live Share",
			properties: {
				"Start Location": liveShareStartLocation
			}
		});
		HostApi.instance.send(LiveShareStartSessionRequestType, {
			threadId,
			streamId: postStreamId,
			createNewStream: false
		});

		return true;
	};

	runSlashCommand = (command, args) => {
		switch ((command || "").toLowerCase()) {
			case "help":
				return this.postHelp();
			case "add":
				return this.addMembersToStream(args);
			case "archive":
				return this.archiveChannel();
			// case "delete":
			// 	return this.deleteChannel();
			case "invite":
				return this.invitePerson(args);
			case "leave":
				return this.leaveChannel();
			case "liveshare":
				return this.startLiveShare(args);
			case "me":
				return false;
			case "msg":
				return this.sendDirectMessage(args);
			case "mute":
				return this.toggleMute();
			// case "muteall":
			// 	return this.toggleMuteAll();
			case "open":
				return this.openStream(args);
			// case "prefs":
			// 	return this.openPrefs(args);
			case "purpose":
				return this.setPurpose(args);
			case "remove":
				return this.removeFromStream(args);
			case "rename":
				return this.renameChannel(args);
			case "slack":
				return this.printSlackInstructions(args);
			case "version":
				return this.postVersion();
			case "who":
				return this.showMembers();
		}
	};

	checkForSlashCommands = text => {
		const substitute = text.match(/^s\/(.+)\/(.*)\/$/);
		if (substitute && this.substituteLastPost(substitute)) return true;

		const commandMatch = text.match(/^\/(\w+)\b\s*(.*)/);
		if (commandMatch) {
			const command = commandMatch[1];
			const args = commandMatch[2];
			return this.runSlashCommand(command, args);
		}

		return false;
	};

	// create a new post
	submitPlainPost = async text => {
		const mentionedUserIds = this.findMentionedUserIds(text, this.props.teammates);

		if (this.checkForSlashCommands(text)) return;

		const { activePanel, createPost, postStreamId } = this.props;
		await createPost(postStreamId, this.props.threadId, text, null, mentionedUserIds, {
			entryPoint: "Stream"
		});
		if (activePanel === "main") {
			safe(() => this.scrollPostsListToBottom());
		}
	};

	submitCodemark = async (attributes, crossPostIssueValues) => {
		if (this.state.composeBoxProps.isEditing) {
			this.props.editCodemark(this.state.composeBoxProps.editingCodemark.id, {
				color: attributes.color,
				text: attributes.text,
				title: attributes.title,
				assignees: attributes.assignees
			});
			return this.setMultiCompose(false);
		} else {
			const submit = async markers => {
				const { threadId } = this.props;
				await this.props.createPost(
					attributes.streamId,
					threadId,
					null,
					{ ...attributes, markers },
					this.findMentionedUserIds(attributes.text || "", this.props.teammates),
					{
						fileUri,
						crossPostIssueValues,
						entryPoint: this.newPostEntry
					}
				);
				if (attributes.streamId !== this.props.postStreamId) {
					this.props.setCurrentStream(attributes.streamId);
				} else this.setMultiCompose(false);
				// this.setActivePanel("main");
				safe(() => this.scrollPostsListToBottom());
			};
			const { quote } = this.state;
			if (!quote) return submit([]);

			const fileUri = quote.uri;

			let marker = {
				code: quote.contents,
				range: quote.range
			};

			if (quote.scm) {
				marker.file = quote.scm.file;
				marker.source = quote.scm;
			}

			const markers = [marker];

			let warning;
			if (quote.scm) {
				if (!quote.scm.remotes || quote.scm.remotes.length === 0) {
					warning = {
						title: "No Remote URL",
						message:
							"This repo doesn’t have a remote URL configured. When your teammates view this post, we won’t be able to connect the code block to the appropriate file in their IDE."
					};
				}
			} else if (quote.error) {
				warning = {
					title: "Missing Git Info",
					message:
						"This repo doesn’t appear to be managed by Git. When your teammates view this post, we won’t be able to connect the code block to the appropriate file in their IDE."
				};
			}

			if (warning) {
				return confirmPopup({
					title: warning.title,
					message: () => (
						<span>
							{warning.message + " "}
							<a href="https://help.codestream.com/hc/en-us/articles/360001530571-Git-Issues">
								Learn more
							</a>
						</span>
					),
					centered: true,
					buttons: [
						{
							label: "Post Anyway",
							action: () => submit(markers)
						},
						{ label: "Cancel" }
					]
				});
			} else submit(markers);
		}
	};

	// Legacy post creation.
	submitPost = ({ text, quote, mentionedUserIds, forceStreamId, forceThreadId, codemark }) => {
		const markers = [];
		if (codemark) codemark.markers = markers;
		const { postStreamId, createPost, editCodemark } = this.props;
		let fileUri;

		if (this.checkForSlashCommands(text)) return;

		let threadId = forceThreadId || this.props.threadId;
		const streamId = forceStreamId || postStreamId;

		const { composeBoxProps } = this.state;
		if (composeBoxProps.isEditing) {
			editCodemark(composeBoxProps.editingCodemark.id, {
				color: codemark.color,
				text: codemark.text,
				title: codemark.title,
				assignees: codemark.assignees
			});
			return this.setMultiCompose(false);
		}

		const submit = async () => {
			await createPost(streamId, threadId, text, codemark, mentionedUserIds, {
				fileUri
			});
			if (codemark && codemark.streamId && codemark.streamId !== postStreamId) {
				this.props.setCurrentStream(codemark.streamId);
				this.setActivePanel("main");
			} else if (this.props.activePanel === "main") {
				safe(() => this.scrollPostsListToBottom());
			}
		};

		if (quote) {
			fileUri = quote.fileUri;

			let marker = {
				code: quote.code,
				range: quote.range,
				file: quote.file
			};

			if (quote.source) {
				marker.file = quote.source.file;
				marker.source = quote.source;
			}

			markers.push(marker);

			let warning;
			if (quote.source) {
				if (!quote.source.remotes || quote.source.remotes.length === 0) {
					warning = {
						title: "No Remote URL",
						message:
							"This repo doesn’t have a remote URL configured. When your teammates view this post, we won’t be able to connect the code block to the appropriate file in their IDE."
					};
				}
			} else if (quote.gitError) {
				warning = {
					title: "Missing Git Info",
					message:
						"This repo doesn’t appear to be managed by Git. When your teammates view this post, we won’t be able to connect the code block to the appropriate file in their IDE."
				};
			}

			if (warning) {
				return confirmPopup({
					title: warning.title,
					message: () => (
						<span>
							{warning.message + " "}
							<a href="https://help.codestream.com/hc/en-us/articles/360001530571-Git-Issues">
								Learn more
							</a>
						</span>
					),
					centered: true,
					buttons: [
						{
							label: "Post Anyway",
							action: submit
						},
						{ label: "Cancel" }
					]
				});
			}
		}
		submit();
	};
}

const sum = (total, num) => total + Math.round(num);

const mapStateToProps = state => {
	const {
		capabilities,
		configs,
		connectivity,
		session,
		context,
		streams,
		users,
		pluginVersion,
		posts,
		preferences,
		messaging,
		teams,
		onboarding,
		services,
		umis
	} = state;

	const team = teams[context.currentTeamId];
	const teamMembers = getTeamMembers(state);
	// console.log("MEMBER IDS ARE: ", teams[context.currentTeamId].memberIds);
	// console.log("USERS ARE: ", users);
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

	const isOffline = connectivity.offline;

	// FIXME -- eventually we'll allow the user to switch to other streams, like DMs and channels
	const teamStream = getStreamForTeam(streams, context.currentTeamId) || {};
	const postStream =
		getStreamForId(streams, context.currentTeamId, context.currentStreamId) || teamStream;
	const streamPosts = getPostsForStream(posts, postStream.id);

	const user = users[session.userId];

	const providerInfo = (user.providerInfo && user.providerInfo[context.currentTeamId]) || {};

	const channelMembers = postStream.isTeamStream
		? teamMembers
		: postStream.memberIds
		? postStream.memberIds.map(id => users[id])
		: [];

	const teamMembersById = toMapBy("id", teamMembers);

	const postStreamName =
		postStream.type === "direct"
			? getDMName(postStream, teamMembersById, session.userId)
			: postStream.name;

	const channelStreams = _sortBy(
		getChannelStreamsForTeam(streams, context.currentTeamId, session.userId) || [],
		stream => (stream.name || "").toLowerCase()
	);

	const directMessageStreams = (
		getDirectMessageStreamsForTeam(streams, context.currentTeamId) || []
	).map(stream => ({
		...stream,
		name: getDMName(stream, teamMembersById, session.userId)
	}));

	return {
		pluginVersion,
		channelStreams,
		directMessageStreams,
		activePanel: context.panelStack[0],
		threadId: context.threadId,
		umis: {
			...umis,
			totalUnread: Object.values(umis.unreads).reduce(sum, 0),
			totalMentions: Object.values(umis.mentions).reduce(sum, 0)
		},
		configs,
		isOffline,
		teamMembersById,
		teammates: teamMembers,
		postStream,
		postStreamId: postStream.id,
		postStreamName,
		postStreamPurpose: postStream.purpose,
		postStreamType: postStream.type,
		postStreamIsTeamStream: postStream.isTeamStream,
		postStreamMemberIds: postStream.memberIds,
		providerInfo,
		isPrivate: postStream.privacy === "private",
		teamId: context.currentTeamId,
		teamName: team.name || "",
		repoId: context.currentRepoId,
		hasFocus: context.hasFocus,
		currentFile: context.currentFile,
		currentCommit: context.currentCommit,
		textEditorVisibleRanges: context.textEditorVisibleRanges,
		textEditorUri: context.textEditorUri,
		usernamesRegexp: usernamesRegexp,
		currentUserId: user.id,
		currentUserName: user.username,
		mutedStreams: preferences.mutedStreams || {},
		starredStreams: preferences.starredStreams || {},
		slashCommands: getSlashCommands(capabilities),
		team: teams[context.currentTeamId],
		channelMembers,
		services,
		isSlackTeam:
			teams[context.currentTeamId].providerInfo && teams[context.currentTeamId].providerInfo.slack,
		posts: streamPosts.map(post => {
			let user = users[post.creatorId];
			if (!user) {
				if (post.creatorId === "codestream") {
					user = {
						username: "CodeStream",
						email: "",
						fullName: ""
					};
				} else {
					// console.warn(
					// 	`Redux store doesn't have a user with id ${post.creatorId} for post with id ${post.id}`
					// );
					user = {
						username: "Unknown user",
						email: "",
						fullName: ""
					};
				}
			}
			const { username, email, fullName = "", color } = user;
			return {
				...post,
				author: {
					username,
					email,
					color,
					fullName
				}
			};
		})
	};
};

export default connect(
	mapStateToProps,
	{
		...actions,
		setCurrentStream
	}
)(injectIntl(SimpleStream));
