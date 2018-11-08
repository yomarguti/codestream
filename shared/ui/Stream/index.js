import React, { Component } from "react";
import { injectIntl } from "react-intl";
import { connect } from "react-redux";
import _ from "underscore";
import createClassString from "classnames";
import ComposeBox from "./ComposeBox";
import PostList from "./PostList";
import DateSeparator from "./DateSeparator";
import ChannelPanel from "./ChannelPanel";
import PeoplePanel from "./PeoplePanel";
import InvitePanel from "./InvitePanel";
import PublicChannelPanel from "./PublicChannelPanel";
import CreateChannelPanel from "./CreateChannelPanel";
import ScrollBox from "./ScrollBox";
import KnowledgePanel from "./KnowledgePanel";
import CreateDMPanel from "./CreateDMPanel";
import ChannelMenu from "./ChannelMenu";
import Post from "./Post";
import Icon from "./Icon";
import CancelButton from "./CancelButton";
import Tooltip from "./Tooltip";
import OfflineBanner from "./OfflineBanner";
import EventEmitter from "../event-emitter";
import * as actions from "./actions";
import { isInVscode, safe, toMapBy } from "../utils";
import { getSlashCommands } from "./SlashCommands";
import { confirmPopup } from "./Confirm";
import { getPostsForStream } from "../reducers/posts";
import {
	getStreamForId,
	getStreamForTeam,
	getStreamForRepoAndFile,
	getChannelStreamsForTeam,
	getDirectMessageStreamsForTeam,
	getDMName
} from "../reducers/streams";
import VsCodeKeystrokeDispatcher from "../utilities/vscode-keystroke-dispatcher";

const EMAIL_MATCH_REGEX = new RegExp(
	"[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*",
	"g"
);

export class SimpleStream extends Component {
	disposables = [];

	constructor(props) {
		super(props);

		this.state = {
			topTab: "chat",
			threadId: props.initialThreadId,
			threadTrigger: null
		};
		this._compose = React.createRef();
	}

	componentDidMount() {
		this.setUmiInfo();
		this.disposables.push(
			EventEmitter.on("interaction:stream-thread-selected", this.handleStreamThreadSelected)
		);
		this.disposables.push(
			EventEmitter.subscribe("interaction:code-highlighted", this.handleCodeHighlightEvent)
		);

		// this.props.fetchPostsForStreams();

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
						if (event.target.id.includes("input-div-")) {
							this.handleEscape(event);
						} else if (this.state.searchBarOpen) {
							this.handleClickSearch(event);
						} else if (this.state.threadId) {
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
							if (event.target.textContent.length === 0) this.editLastPost(event);
						} else {
							this.editLastPost(event);
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

	handleCodeHighlightEvent = body => {
		// make sure we have a compose box to type into
		this.setMultiCompose(true);
		this.setState({ quote: body });
	};

	goToThread = post => {
		const threadId = post.parentPostId || post.id;
		this.handleStreamThreadSelected({ streamId: post.postStreamId, threadId });
	};

	handleStreamThreadSelected = async ({ streamId, threadId }) => {
		if (streamId !== this.props.postStreamId) {
			this.props.setCurrentStream(streamId);
		}
		if (threadId) this.openThread(threadId);
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

		if (!!prevState.searchBarOpen === false && this.state.searchBarOpen) {
			requestAnimationFrame(() => this._searchInput.focus());
		}

		if (this.props.activePanel === "main" && prevProps.activePanel !== "main") {
			// if we are switching from a non-main panel
			this.focusInput();
		}

		// when going in and out of threads, make sure the streams are all
		// the right height
		if (prevState.threadId !== this.state.threadId) {
			this.resizeStream();
		}

		this.setUmiInfo(prevProps);

		const switchedStreams = postStreamId && postStreamId !== prevProps.postStreamId;
		if (switchedStreams) {
			this.handleDismissThread({ track: false });
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

	// return the post, if any, with the given ID
	findPostById(id) {
		return this.props.posts.find(post => id === post.id);
	}

	handleClickHelpLink = event => {
		event.preventDefault();
		EventEmitter.emit("interaction:clicked-link", "https://help.codestream.com");
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

	renderThreadPosts = threadId => {
		let lastTimestamp = 0;
		return this.props.posts.map(post => {
			if (post.deactivated) return null;
			if (!threadId || threadId !== post.parentPostId) {
				return null;
			}
			// this needs to be done by storing the return value of the render,
			// then setting lastTimestamp, otherwise you wouldn't be able to
			// compare the current one to the prior one.
			const returnValue = (
				<div key={post.id}>
					<DateSeparator timestamp1={lastTimestamp} timestamp2={post.createdAt} />
					<Post
						id={post.id}
						streamId={this.props.postStreamId}
						usernames={this.props.usernamesRegexp}
						teammates={this.props.teammates}
						currentUserId={this.props.currentUserId}
						currentUserName={this.props.currentUserName}
						showDetails="1"
						currentCommit={this.props.currentCommit}
						editing={post.id === this.state.editingPostId}
						action={this.postAction}
						didTriggerThread={this.state.threadTrigger === post.id}
					/>
				</div>
			);
			lastTimestamp = post.createdAt;
			return returnValue;
		});
	};

	// we render both a main stream (postslist) plus also a postslist related
	// to the currently selected thread (if it exists). the reason for this is
	// to be able to animate between the two streams, since they will both be
	// visible during the transition
	render() {
		const { configs, umis, postStreamPurpose } = this.props;
		let { activePanel } = this.props;
		const { searchBarOpen, q } = this.state;
		if (searchBarOpen && q) activePanel = "knowledge";

		let threadId = this.state.threadId;
		let threadPost = this.findPostById(threadId);

		const streamClass = createClassString({
			stream: true,
			"has-overlay": threadId,
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

		let placeholderText = "Message #" + this.props.postStreamName;
		if (this.props.postStreamType === "direct") {
			placeholderText = "Message " + this.props.postStreamName;
		}
		if (activePanel === "thread" && threadPost) {
			placeholderText = "Reply to " + threadPost.author.username;
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
		const umisClass = createClassString("umis", {
			mentions: umis.totalMentions > 0,
			unread: umis.totalMentions == 0 && umis.totalUnread > 0
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

		// const totalUMICount = umis.totalMentions || umis.totalUnread || "";
		// const totalUMICount = umis.totalMentions || umis.totalUnread ? "&middot;" : "\u25C9";
		const totalUMICount = umis.totalMentions ? (
			<label>{umis.totalMentions > 99 ? "99+" : umis.totalMentions}</label>
		) : umis.totalUnread ? (
			<div className="unread-badge" />
		) : (
			// <Icon name="chevron-left" className="show-channels-icon" />
			""
		);

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

		// these panels do not have global nav
		const renderNav = !["create-channel", "create-dm", "public-channels", "invite"].includes(
			activePanel
		);

		return (
			<div className={streamClass}>
				<div id="modal-root" />
				<div id="confirm-root" />
				<div id="focus-trap" className={createClassString({ active: !this.props.hasFocus })} />
				{threadId && <div id="thread-blanket" />}
				{renderNav && (
					<nav>
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
										checked: activePanel === "knowledge",
										muted: !this.props.configs.showMarkers
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
										{!this.props.configs.muteAll && (
											<span className={umisClass}>{totalUMICount}</span>
										)}
									</span>
								</label>
								<label
									className={createClassString({ checked: activePanel === "main" })}
									onClick={e => this.setActivePanel("main")}
								>
									<span className="channel-name">
										{channelIcon}
										{this.props.postStreamName}
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
									<span
										className="align-right-button"
										onClick={e => {
											this.setMultiCompose(true);
										}}
									>
										<Tooltip title="Create Codemark" placement="bottomRight">
											<span>
												<Icon name="plus" className="button" />
											</span>
										</Tooltip>
									</span>
								</div>
							</div>
						)}
					</nav>
				)}
				<div className="content">
					{activePanel === "knowledge" && (
						<KnowledgePanel
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							knowledgeType="comment"
							q={q}
							usernames={this.props.usernamesRegexp}
							currentUserId={this.props.currentUserId}
							currentUserName={this.props.currentUserName}
							postAction={this.postAction}
							setMultiCompose={this.setMultiCompose}
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
									<div className="sep" />,
									<Tooltip title="View member list" placement="bottomLeft">
										<span className="clickable" onClick={e => this.runSlashCommand("who")}>
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
						</div>
					)}
					{threadId && (
						<div className="thread-panel" ref={ref => (this._threadPanel = ref)}>
							<div className="panel-header">
								<CancelButton title={closeThreadTooltip} onClick={this.handleDismissThread} />
								<span>
									<label>
										{commentTypeLabel} in{" "}
										<span
											className="clickable"
											onClick={() => this.handleGotoStream(threadPost.streamId)}
										>
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
							{this.renderComposeBox(placeholderText)}
						</div>
					)}
				</div>
				{!threadId &&
					(activePanel === "main" || this.state.multiCompose) &&
					this.renderComposeBox(placeholderText)}
			</div>
		);
	}

	renderComposeBox = placeholderText => {
		return (
			<ComposeBox
				placeholder={placeholderText}
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
				onSubmit={this.submitPost}
				onEmptyUpArrow={this.editLastPost}
				findMentionedUserIds={this.findMentionedUserIds}
				isDirectMessage={this.props.postStreamType === "direct"}
				isSlackTeam={this.props.isSlackTeam}
				multiCompose={this.state.multiCompose}
				setMultiCompose={this.setMultiCompose}
				quote={this.state.quote}
			/>
		);
	};

	handleGotoStream = streamId => {
		this.setState({ threadId: null, threadTrigger: null });
		this.props.setCurrentStream(streamId);
		this.setActivePanel("main");
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
		this.setState({ searchBarOpen: !searchBarOpen });
	};

	setTopTab = type => {
		this.setState({ topTab: type });
		setTimeout(() => {
			// this.focusInput();
		}, 20);
	};

	setMultiCompose = value => {
		this.setState({ multiCompose: value });
		if (!value) this.setState({ quote: null });
		// if (value) this.focus();
	};

	setKnowledgeType = type => {
		this.setState({ knowledgeType: type });
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
		return _.chain(this.props.posts)
			.filter(post => {
				return post.author.username === me && post.seqNum < seqNum;
			})
			.last()
			.value();
	}

	editLastPost = _event => {
		const { activePanel } = this.props;
		let list;
		if (activePanel === "thread") list = this._threadpostslist;
		if (activePanel === "main") {
			list = this._postslist;
		}
		const post = list.getUsersMostRecentPost();
		if (post)
			this.setState({ editingPostId: post.id }, () => {
				list.scrollTo(post.id);
			});
	};

	showChannels = _event => {
		this.setActivePanel("channels");
	};

	setActivePanel = panel => {
		if (panel !== this.props.activePanel) {
			this.props.setPanel(panel);
		}
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
		EventEmitter.emit("interaction:thread-closed", this.state.threadId);
		this.setState({ threadId: null, threadTrigger: null });
		// this.setActivePanel("main");
		this.focusInput();
		if (track)
			EventEmitter.emit("analytics", {
				label: "Page Viewed",
				payload: { "Page Name": "Source Stream" }
			});
	};

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

	quotePost = post => {};

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
				return this.setState({ editingPostId: post.id });
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
		if (this.state.threadId) inputId = `thread-${inputId}`;
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
	};

	openThread = (threadId, wasClicked = false) => {
		EventEmitter.emit("analytics", {
			label: "Page Viewed",
			payload: { "Page Name": "Thread View" }
		});
		this.setState({ threadId, threadTrigger: wasClicked && threadId });
		// this.setActivePanel("thread");

		this.focusInput();
		if (wasClicked) {
			EventEmitter.emit("interaction:thread-selected", {
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
				if (_.contains(memberIds, user.id)) names.push(user.username);
			});
		}
		names = _.sortBy(names, name => name.toLowerCase());

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
			const newStream = await this.props.renameStream(this.props.postStreamId, args);
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
			const newStream = await this.props.setPurpose(this.props.postStreamId, args);
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
		const threadId = this.state.threadId;
		const lastPost = _.last(posts);
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
		EventEmitter.emit("interaction:svc-request", {
			service: "vsls",
			action: {
				type: "invite",
				userId: userId,
				createNewStream: false
			}
		});

		return true;
	};

	startLiveShare = () => {
		const { postStreamId } = this.props;
		const threadId = this.state.threadId;

		const text = "Starting Live Share...";
		this.submitSystemPost(text);

		EventEmitter.emit("interaction:svc-request", {
			service: "vsls",
			action: {
				type: "start",
				streamId: postStreamId,
				threadId: threadId,
				createNewStream: false
			}
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
				return this.startLiveShare();
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
	submitPost = ({
		text,
		title,
		quote,
		mentionedUserIds,
		autoMentions,
		forceStreamId,
		forceThreadId,
		type,
		assignees,
		color
	}) => {
		const codeBlocks = [];
		const { activePanel, postStreamId, createPost } = this.props;
		let fileUri;

		if (this.checkForSlashCommands(text)) return;

		let threadId = forceThreadId || this.state.threadId;
		const streamId = forceStreamId || postStreamId;

		const submit = () =>
			createPost(streamId, threadId, text, codeBlocks, mentionedUserIds, {
				title,
				autoMentions,
				fileUri,
				type,
				assignees,
				color
			}).then(this.scrollPostsListToBottom);

		if (quote) {
			fileUri = quote.fileUri;

			let codeBlock = {
				code: quote.code,
				location: quote.location,
				file: quote.file
			};

			if (quote.source) {
				codeBlock.file = quote.source.file;
				codeBlock.source = quote.source;
			}

			codeBlocks.push(codeBlock);

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
							<a
								// onClick={e => {
								// 	e.preventDefault();
								// 	EventEmitter.emit(
								// 		"interaction:clicked-link",
								// 		"https://help.codestream.com/hc/en-us/articles/360001530571-Git-Issues"
								// 	);
								// }}
								href="https://help.codestream.com/hc/en-us/articles/360001530571-Git-Issues"
							>
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

const mapStateToProps = ({
	capabilities,
	configs,
	connectivity,
	session,
	context,
	startupProps,
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
}) => {
	const fileStream =
		getStreamForRepoAndFile(streams, context.currentRepoId, context.currentFile) || {};

	const team = teams[context.currentTeamId];
	const teamMembers = team.memberIds.map(id => users[id]).filter(Boolean);
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

	const isOffline =
		connectivity.offline || messaging.failedSubscriptions.length > 0 || messaging.timedOut;

	// FIXME -- eventually we'll allow the user to switch to other streams, like DMs and channels
	const teamStream = getStreamForTeam(streams, context.currentTeamId) || {};
	const postStream =
		getStreamForId(streams, context.currentTeamId, context.currentStreamId) || teamStream;
	const streamPosts = getPostsForStream(posts, postStream.id);

	const user = users[session.userId];

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

	const channelStreams = _.sortBy(
		getChannelStreamsForTeam(streams, context.currentTeamId, session.userId) || [],
		stream => (stream.name || "").toLowerCase()
	);

	const directMessageStreams = (
		getDirectMessageStreamsForTeam(streams, context.currentTeamId) || []
	).map(stream => ({
		...stream,
		name: getDMName(stream, toMapBy("id", teamMembers), session.userId)
	}));

	return {
		pluginVersion,
		channelStreams,
		directMessageStreams,
		activePanel: context.panel,
		startOnMainPanel: startupProps.startOnMainPanel,
		initialThreadId: startupProps.threadId,
		umis: {
			...umis,
			totalUnread: Object.values(_.omit(umis.unreads, postStream.id)).reduce(sum, 0),
			totalMentions: Object.values(_.omit(umis.mentions, postStream.id)).reduce(sum, 0)
			// totalUnread: Object.values(umis.unreads).reduce(sum, 0),
			// totalMentions: Object.values(umis.mentions).reduce(sum, 0)
		},
		configs,
		isOffline,
		teamMembersById,
		teammates: teamMembers.filter(({ deactivated }) => !deactivated),
		postStream,
		postStreamId: postStream.id,
		postStreamName,
		postStreamPurpose: postStream.purpose,
		postStreamType: postStream.type,
		postStreamIsTeamStream: postStream.isTeamStream,
		postStreamMemberIds: postStream.memberIds,
		isPrivate: postStream.privacy === "private",
		fileStreamId: fileStream.id,
		teamId: context.currentTeamId,
		teamName: team.name || "",
		repoId: context.currentRepoId,
		hasFocus: context.hasFocus,
		firstTimeInAtom: onboarding.firstTimeInAtom,
		currentFile: context.currentFile,
		currentCommit: context.currentCommit,
		editingUsers: fileStream.editingUsers,
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
		...actions
	}
)(injectIntl(SimpleStream));
