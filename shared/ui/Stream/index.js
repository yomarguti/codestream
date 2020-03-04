import React, { Component } from "react";
import PropTypes from "prop-types";
import { injectIntl } from "react-intl";
import { connect } from "react-redux";
import cx from "classnames";
import ComposeBox from "./ComposeBox";
import PostList from "./PostList";
import { ActivityPanel } from "./ActivityPanel";
import { StatusPanel } from "./StatusPanel";
import { NotificationsPanel } from "./NotificationsPanel";
import ChannelPanel from "./ChannelPanel";
import { TasksPanel } from "./TasksPanel";
import { TeamPanel } from "./TeamPanel";
import PublicChannelPanel from "./PublicChannelPanel";
import CreateChannelPanel from "./CreateChannelPanel";
import ScrollBox from "./ScrollBox";
import { CodemarkForm } from "./CodemarkForm";
import { ReviewForm } from "./ReviewForm";
import { CodeForm } from "./CodeForm";
import KnowledgePanel from "./KnowledgePanel";
import FilterSearchPanel from "./FilterSearchPanel";
import InlineCodemarks from "./InlineCodemarks";
import CreateDMPanel from "./CreateDMPanel";
import { CreateTeamPage } from "./CreateTeamPage";
import ChannelMenu from "./ChannelMenu";
import Icon from "./Icon";
import Menu from "./Menu";
import CancelButton from "./CancelButton";
import Tooltip from "./Tooltip";
import OfflineBanner from "./OfflineBanner";
import ConfigureAzureDevOpsPanel from "./ConfigureAzureDevOpsPanel";
import ConfigureYouTrackPanel from "./ConfigureYouTrackPanel";
import ConfigureJiraServerPanel from "./ConfigureJiraServerPanel";
import ConfigureEnterprisePanel from "./ConfigureEnterprisePanel";
import { PrePRProviderInfoModal } from "./PrePRProviderInfoModal";
import * as actions from "./actions";
import { editCodemark } from "../store/codemarks/actions";
import {
	ComponentUpdateEmitter,
	safe,
	toMapBy,
	isNotOnDisk,
	uriToFilePath,
	mapFilter
} from "../utils";
import { getSlashCommands } from "./SlashCommands";
import { confirmPopup } from "./Confirm";
import { ModalRoot, Modal } from "./Modal";
import { getPostsForStream, getPost } from "../store/posts/reducer";
import {
	isConnected as isConnectedToProvider,
	getConnectedSharingTargets
} from "../store/providers/reducer";
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
	LiveShareInviteToSessionRequestType,
	LiveShareStartSessionRequestType,
	NewCodemarkNotificationType,
	NewReviewNotificationType,
	EditorSelectRangeRequestType,
	WebviewPanels
} from "../ipc/webview.protocol";
import {
	OpenUrlRequestType,
	SetCodemarkPinnedRequestType,
	TelemetryRequestType,
	GetRangeScmInfoRequestType
} from "@codestream/protocols/agent";
import { getFileScmError } from "../store/editorContext/reducer";
import { logout, switchToTeam } from "../store/session/actions";
import { CodemarkView } from "./CodemarkView";
import { Review } from "./Review";

import {
	setCurrentStream,
	setNewPostEntry,
	setCurrentReview,
	setActiveReview
} from "../store/context/actions";
import { getTeamProvider } from "../store/teams/reducer";
import {
	filter as _filter,
	includes as _includes,
	last as _last,
	sortBy as _sortBy
} from "lodash-es";
import { PROVIDER_MAPPINGS } from "./CrossPostIssueControls/types";
import { ComposeKeybindings } from "./ComposeTitles";

const EMAIL_MATCH_REGEX = new RegExp(
	"[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*",
	"g"
);

export class SimpleStream extends Component {
	disposables = [];
	state = {
		composeBoxProps: {}
	};
	_compose = React.createRef();
	updateEmitter = new ComponentUpdateEmitter();

	static contextTypes = {
		store: PropTypes.object
	};

	_pollingTimer;

	componentDidMount() {
		if (
			this.props.activePanel === "main" &&
			this.props.postStreamId != undefined &&
			this.props.hasFocus
		) {
			HostApi.instance.track("Page Viewed", { "Page Name": "Stream" });
		}
		this.setUmiInfo();
		this.disposables.push(
			HostApi.instance.on(NewCodemarkNotificationType, this.handleNewCodemarkRequest, this)
		);
		this.disposables.push(
			HostApi.instance.on(NewReviewNotificationType, this.handleNewReviewRequest, this)
		);

		// this listener pays attention to when the input field resizes,
		// presumably because the user has typed more than one line of text
		// in it, and calls a function to handle the new size
		// if (this._compose.current)
		// 	new ResizeObserver(this.handleResizeCompose).observe(this._compose.current);

		// go ahead and do resizing because some environments (VS Code) have a
		// polyfill for ResizeObserver which won't be triggered automatically
		this.handleResizeCompose();

		if (this.props.isInVscode) {
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
				})
			);
		}

		this.startPollingReplies(false);
	}

	componentWillUnmount = () => {
		this.stopPollingReplies();
		this.disposables.forEach(d => d.dispose());
	};

	startPollingReplies(prefetch) {
		if (this.props.capabilities.providerSupportsRealtimeEvents) return;

		if (prefetch) {
			this.fetchReplies();
		}

		if (this._pollingTimer !== undefined) return;

		this._pollingTimer = setInterval(() => {
			if (
				this.props.hasFocus &&
				this.props.threadId !== undefined &&
				this.props.activePanel === WebviewPanels.Codemarks
			) {
				this.fetchReplies();
			}
		}, 5000);
	}

	stopPollingReplies() {
		if (this._pollingTimer === undefined) return;

		clearInterval(this._pollingTimer);
		this._pollingTimer = undefined;
	}

	async fetchReplies() {
		return this.props.fetchThread(this.props.postStreamId, this.props.threadId);
	}

	handleNewCodemarkRequest(e) {
		if (this.props.activePanel === WebviewPanels.CodemarksForFile) return;

		// re-emit the the notification after switching to spatial view
		this.updateEmitter.enqueue(() => {
			HostApi.instance.emit(NewCodemarkNotificationType.method, e);
		});
		this.props.openPanel(WebviewPanels.CodemarksForFile);
	}

	handleNewReviewRequest(e) {
		this.props.openPanel(WebviewPanels.NewReview);
	}

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
		this.updateEmitter.emit();
		const { postStreamId } = this.props;

		if (this.props.textEditorUri !== prevProps.textEditorUri) {
			this.setState({ selection: undefined });
		}
		if (this.props.activePanel === "main" && prevProps.activePanel !== "main") {
			if (this.props.postStreamId != undefined && this.props.hasFocus) {
				HostApi.instance.track("Page Viewed", { "Page Name": "Stream" });
			}
			// if we are switching from a non-main panel
			this.focusInput();
		}

		// when going in and out of threads, make sure the streams are all
		// the right height
		if (prevProps.threadId !== this.props.threadId) {
			this.resizeStream();
			if (this.props.threadId) this.focusInput();
		}

		this.setUmiInfo(prevProps);

		const switchedStreams = postStreamId && postStreamId !== prevProps.postStreamId;
		if (switchedStreams) {
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

	buildTeamMenuItem() {
		const { userTeams, teamId: currentTeamId } = this.props;

		const buildSubmenu = () => {
			const items = userTeams.map(team => {
				const isCurrentTeam = team.id === currentTeamId;
				return {
					key: team.id,
					label: team.name,
					icon: isCurrentTeam ? <Icon name="check" /> : undefined,
					noHover: isCurrentTeam,
					action: () => {
						if (isCurrentTeam) return;

						this.props.switchToTeam(team.id);
					}
				};
			});

			const isOnACodestreamTeam = userTeams.find(team => getTeamProvider(team) === "codestream");
			if (isOnACodestreamTeam) {
				items.push(
					{ label: "-" },
					{
						key: "create-team",
						label: "Create New Team",
						action: () => {
							this.setState({ showCreateTeamModal: true });
						}
					}
				);
			}

			return items;
		};

		return {
			label: "Switch Team",
			submenu: buildSubmenu()
		};
	}

	renderMenu() {
		const { menuOpen, menuTarget } = this.state;
		// const inviteLabel = this.props.isCodeStreamTeam
		// 	? "Invite People"
		// 	: "Invite People to CodeStream";

		const { apiCapabilities, inSharingModel } = this.props;

		const menuItems = [
			this.buildTeamMenuItem(),
			{ label: "-" }
			// { label: inviteLabel, action: "invite" },
		].filter(Boolean);

		// FIXME apiCapabilities (this moved to the + menu on global nav)
		// menuItems.push({
		// 	label: "Set a Status",
		// 	action: () => this.setActivePanel(WebviewPanels.Status)
		// });

		if (apiCapabilities["follow"] && inSharingModel) {
			menuItems.push(
				{
					label: "Notifications...",
					action: () => this.setActivePanel(WebviewPanels.Notifications)
				},
				{ label: "-" }
			);
		}

		const providerMenuItems = this.addProvidersToMenu();
		if (providerMenuItems.length > 0) {
			// menuItems.push({ label: "Integrations", key: "integrations", submenu: providerMenuItems });
			menuItems.push(...providerMenuItems);
			menuItems.push({ label: "-" });
		}
		menuItems.push(
			{ label: "Feedback", action: "feedback" },
			{ label: "Help", action: "help" },
			{ label: "-" }
		);

		menuItems.push({ label: "Sign Out", action: "signout" });

		menuItems.push({ label: "-" });
		const text = (
			<span style={{ fontSize: "smaller" }}>
				You are signed in as {this.props.currentUserName}
				{this.props.currentUserEmail && <span> ({this.props.currentUserEmail})</span>}
				<br />
				This is CodeStream version {this.props.pluginVersion}
			</span>
		);
		menuItems.push({ label: text, action: "", noHover: true, disabled: true });

		const menu = menuOpen ? (
			<Menu
				title={this.props.teamName}
				items={menuItems}
				target={menuTarget}
				action={this.menuAction}
				align="dropdownRight"
			/>
		) : null;
		return menu;
	}

	newComment = () => {
		this.setActivePanel(WebviewPanels.NewComment);
	};

	newIssue = () => {
		this.setActivePanel(WebviewPanels.NewIssue);
	};

	newReview = () => {
		this.setActivePanel(WebviewPanels.NewReview);
	};

	newCode = () => {
		this.setActivePanel(WebviewPanels.NewCode);
	};

	renderPlusMenu() {
		const { plusMenuOpen, menuTarget } = this.state;

		const menuItems = [];
		if (this.props.apiCapabilities.xray) {
			menuItems.push(
				{
					icon: <Icon name="code" />,
					label: "Start Work",
					action: () => this.setActivePanel(WebviewPanels.Status),
					shortcut: ComposeKeybindings.work,
					key: "code"
				},
				{ label: "-" }
			);
		}
		menuItems.push(
			{
				icon: <Icon name="comment" />,
				label: "New Comment",
				action: this.newComment,
				shortcut: ComposeKeybindings.comment,
				key: "comment"
			},
			{
				icon: <Icon name="issue" />,
				label: "New Issue",
				action: this.newIssue,
				shortcut: ComposeKeybindings.issue,
				key: "issue"
			}
		);
		if (this.props.apiCapabilities.lightningCodeReviews) {
			menuItems.push(
				{ label: "-" },
				{
					icon: <Icon name="review" />,
					label: "Request A Code Review",
					action: this.newReview,
					shortcut: ComposeKeybindings.review,
					key: "review"
				}
			);
		}
		// { label: "-" }
		// { label: inviteLabel, action: "invite" },

		return plusMenuOpen ? (
			<Menu
				items={menuItems}
				target={menuTarget}
				action={this.plusMenuAction}
				align="dropdownRight"
			/>
		) : null;
	}

	addProvidersToMenu() {
		const menuItems = [];
		for (let providerId of Object.keys(this.props.providers)) {
			const provider = this.props.providers[providerId];
			const { name, isEnterprise, host, needsConfigure, forEnterprise } = provider;
			const display = PROVIDER_MAPPINGS[name];
			if (display && provider.hasIssues) {
				const displayHost = host.startsWith("http://")
					? host.split("http://")[1]
					: host.startsWith("https://")
					? host.split("https://")[1]
					: host;
				const displayName = isEnterprise
					? `${display.displayName} - ${displayHost}`
					: display.displayName;
				const isConnected = isConnectedToProvider(this.context.store.getState(), {
					id: provider.id
				});
				let label = `Connect to ${displayName}`;
				let action;
				if (isConnected) {
					// if you have a token and are connected to the provider,
					// offer to disconnect
					label = `Disconnect ${displayName}`;
					action = () => this.props.disconnectProvider(providerId, "Global Nav");
				} else if (needsConfigure) {
					// otherwise, if it's a provider that needs to be pre-configured,
					// bring up the custom popup for configuring it
					action = () => this.setActivePanel(`configure-provider-${name}-${providerId}-Global Nav`);
				} else if (forEnterprise) {
					// otherwise if it's for an enterprise provider, configure for enterprise
					action = () => {
						/* if (name === "github_enterprise") {
							this.setState({
								propsForPrePRProviderInfoModal: {
									providerName: name,
									helpText: "Requires GitHub Enterprise version 2.17 or higher",
									action: () =>
										this.setActivePanel(`configure-enterprise-${name}-${providerId}-true`),
									onClose: () => this.setState({ propsForPrePRProviderInfoModal: undefined })
								}
							});
						} else */ this.setActivePanel(
							`configure-enterprise-${name}-${providerId}-Global Nav`
						);
					};
				} else {
					// otherwise it's just a simple oauth redirect
					if (name === "github" || name === "bitbucket" || name === "gitlab") {
						action = () =>
							this.setState({
								propsForPrePRProviderInfoModal: {
									providerName: name,
									action: () => this.props.connectProvider(providerId, "Global Nav"),
									onClose: () => this.setState({ propsForPrePRProviderInfoModal: undefined })
								}
							});
					} else action = () => this.props.connectProvider(providerId, "Global Nav");
				}
				menuItems.push({
					key: providerId,
					label,
					action,
					displayName
				});
			}
			// sharing model only
			if (this.props.isCodeStreamTeam && display && provider.hasSharing) {
				const isConnected = isConnectedToProvider(this.context.store.getState(), {
					id: provider.id
				});
				if (isConnected) {
					let subMenu = mapFilter(
						getConnectedSharingTargets(this.context.store.getState()),
						shareTarget => {
							if (shareTarget.providerId !== provider.id) return undefined;

							return {
								key: shareTarget.teamName,
								label: `Disconnect ${shareTarget.teamName}`,
								action: () => {
									this.props.disconnectProvider(provider.id, "Global Nav", shareTarget.teamId);
								}
							};
						}
					);
					if (subMenu.length) {
						subMenu.push({ label: "-" });
						subMenu.push({
							label: `Add ${display.groupName}`,
							action: () => {
								this.props.connectProvider(providerId, "Global Nav");
							}
						});
					}

					menuItems.push({
						key: providerId,
						label: `${display.displayName} Connections`,
						displayName: display.displayName,
						submenu: subMenu
					});
				} else
					menuItems.push({
						key: providerId,
						label: `Connect to ${display.displayName}`,
						action: () => {
							this.props.connectProvider(providerId, "Global Nav");
						},
						displayName: display.displayName
					});
			}
		}
		menuItems.sort((a, b) => {
			return a.displayName.localeCompare(b.displayName);
		});
		return menuItems;
	}

	renderNavIcons() {
		const { activePanel, configs, umis, postStreamPurpose, providerInfo = {} } = this.props;
		const { menuOpen, plusMenuOpen } = this.state;

		const umisClass = cx("umis", {
			mentions: umis.totalMentions > 0,
			unread: umis.totalMentions == 0 && umis.totalUnread > 0
		});
		const totalUMICount = umis.totalMentions ? (
			<div className="mentions-badge">{umis.totalMentions > 99 ? "99+" : umis.totalMentions}</div>
		) : umis.totalUnread ? (
			<div className="unread-badge">.</div>
		) : null;

		const selected = panel => activePanel === panel; // && !plusMenuOpen && !menuOpen;
		return (
			<nav className="inline">
				<label
					className={cx({ selected: selected(WebviewPanels.CodemarksForFile) })}
					onClick={e => this.setActivePanel(WebviewPanels.CodemarksForFile)}
				>
					<Icon name="file" title="Codemarks In Current File" placement="bottom" />
				</label>
				<label
					className={cx({ selected: selected(WebviewPanels.Activity) })}
					onClick={e => this.setActivePanel(WebviewPanels.Activity)}
				>
					<Tooltip title="Activity Feed" placement="bottom">
						<span>
							<Icon name="list" />
							{!this.props.muteAll && <span className={umisClass}>{totalUMICount}</span>}
						</span>
					</Tooltip>
				</label>
				<label onClick={this.togglePlusMenu} className={cx({ active: plusMenuOpen })}>
					<Icon name="plus" title="Create..." placement="bottom" />
					{this.renderPlusMenu()}
				</label>
				<label
					className={cx({ selected: selected(WebviewPanels.People) })}
					onClick={e => this.setActivePanel(WebviewPanels.People)}
				>
					<Icon name="organization" title="Your Team" placement="bottom" />
				</label>
				<label
					className={cx({ selected: selected(WebviewPanels.FilterSearch) })}
					onClick={this.goSearch}
				>
					<Icon name="search" title="Filter &amp; Search" placement="bottomRight" />
				</label>
				<label onClick={this.toggleMenu} className={cx({ active: menuOpen })}>
					<Icon name="kebab-horizontal" title="More..." placement="bottomRight" />
					{this.renderMenu()}
				</label>
			</nav>
		);
	}

	goSearch = () => {
		this.props.openPanel(WebviewPanels.FilterSearch);
	};

	// dead code
	handleClickCreateCodemark = e => {
		e.preventDefault();
		this.setMultiCompose(true);

		this.props.setNewPostEntry("Global Nav");
	};

	// we render both a main stream (postslist) plus also a postslist related
	// to the currently selected thread (if it exists). the reason for this is
	// to be able to animate between the two streams, since they will both be
	// visible during the transition
	render() {
		const { configs, umis, postStreamPurpose, providerInfo = {} } = this.props;
		let { activePanel } = this.props;
		const { searchBarOpen, q } = this.state;
		// if (searchBarOpen && q) activePanel = WebviewPanels.Codemarks;
		if (searchBarOpen) activePanel = WebviewPanels.Codemarks;
		if (this.props.currentReviewId) activePanel = WebviewPanels.CodemarksForFile;

		let threadId = this.props.threadId;
		let threadPost = this.findPostById(threadId);

		const streamClass = cx({
			stream: true,
			"has-overlay":
				(threadId || this.state.multiCompose || this.state.floatCompose) &&
				activePanel !== WebviewPanels.CodemarksForFile,
			"has-floating-compose":
				this.state.floatCompose && activePanel !== WebviewPanels.CodemarksForFile,
			"no-headshots": !configs.showHeadshots
		});
		const threadPostsListClass = cx({
			postslist: true,
			threadlist: true
		});
		const mainPanelClass = cx({
			panel: true,
			"main-panel": true
		});

		let placeholderText = "Comment in #" + this.props.postStreamName;
		let channelName = "#" + this.props.postStreamName;
		if (this.props.postStreamType === "direct") {
			placeholderText = "Message " + this.props.postStreamName;
			channelName = "@" + this.props.postStreamName;
		}
		if (threadId) {
			placeholderText = "Reply...";
			channelName = "Reply...";
		}

		const streamDivId = "stream-" + this.props.postStreamId;

		const unreadsAboveClass = cx({
			unreads: true,
			active: this.state.unreadsAbove
		});
		const unreadsBelowClass = cx({
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

		const textEditorVisibleRanges =
			this.state.textEditorVisibleRanges || this.props.textEditorVisibleRanges;
		const textEditorUri = this.state.textEditorUri || this.props.textEditorUri;

		// these panels do not have global nav
		let renderNav =
			!["create-channel", "create-dm", "public-channels", WebviewPanels.Status].includes(
				activePanel
			) &&
			!this.props.currentReviewId &&
			!activePanel.startsWith("configure-provider-") &&
			!activePanel.startsWith("configure-enterprise-");

		// if (this.state.floatCompose) renderNav = false;
		// if (threadId) renderNav = false;

		const onInlineCodemarks = activePanel === WebviewPanels.CodemarksForFile;
		const contentClass =
			onInlineCodemarks || this.props.currentCodemarkId
				? "content inline"
				: "content vscroll inline";
		const configureProviderInfo =
			activePanel.startsWith("configure-provider-") ||
			activePanel.startsWith("configure-enterprise-")
				? activePanel.split("-")
				: null;

		return (
			<div id="stream-root" className={streamClass}>
				<ModalRoot />
				{this.state.propsForPrePRProviderInfoModal && (
					<PrePRProviderInfoModal {...this.state.propsForPrePRProviderInfoModal} />
				)}
				{this.state.showCreateTeamModal && (
					<Modal onClose={() => this.setState({ showCreateTeamModal: false })}>
						<CreateTeamPage />
					</Modal>
				)}
				<div id="confirm-root" />
				{(threadId || this.props.currentCodemarkId) && (
					<>
						<div id="panel-blanket" />
						{this.props.currentCodemarkId && <CodemarkView />}
					</>
				)}
				{false && this.props.currentReviewId && !this.props.activeReviewId && (
					<Modal onClose={() => this.props.setCurrentReview()}>
						<Review id={this.props.currentReviewId} />
						<br />
						<br />
					</Modal>
				)}
				{renderNav && this.renderNavIcons()}
				{this.state.floatCompose &&
					activePanel !== WebviewPanels.CodemarksForFile &&
					this.renderComposeBox(placeholderText, channelName)}
				<div className={contentClass}>
					{activePanel === WebviewPanels.CodemarksForFile && (
						<InlineCodemarks
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							currentUserId={this.props.currentUserId}
							currentUserName={this.props.currentUserName}
							postAction={this.postAction}
							searchBarOpen={this.state.searchBarOpen}
							multiCompose={this.state.multiCompose}
							typeFilter="all"
							textEditorUri={textEditorUri}
							textEditorVisibleRanges={textEditorVisibleRanges}
							selection={this.state.selection}
							focusInput={this.focusInput}
							scrollDiv={this._contentScrollDiv}
						/>
					)}
					{activePanel === WebviewPanels.Codemarks && (
						<KnowledgePanel
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							currentUserId={this.props.currentUserId}
							currentUserName={this.props.currentUserName}
							postAction={this.postAction}
							searchBarOpen={this.state.searchBarOpen}
							setMultiCompose={this.setMultiCompose}
							typeFilter={this.state.knowledgeType}
						/>
					)}
					{activePanel === WebviewPanels.FilterSearch && <FilterSearchPanel />}
					{activePanel === WebviewPanels.Activity && <ActivityPanel />}
					{activePanel === WebviewPanels.NewComment && (
						<CodemarkForm
							commentType="comment"
							streamId={this.props.postStreamId}
							onSubmit={this.submitNoCodeCodemark}
							onClickClose={this.props.closePanel}
							collapsed={false}
							positionAtLocation={false}
							multiLocation={true}
							noCodeLocation={true}
							setMultiLocation={this.setMultiLocation}
						/>
					)}
					{activePanel === WebviewPanels.NewIssue && (
						<CodemarkForm
							commentType="issue"
							streamId={this.props.postStreamId}
							onSubmit={this.submitNoCodeCodemark}
							onClickClose={this.props.closePanel}
							collapsed={false}
							positionAtLocation={false}
							multiLocation={true}
							noCodeLocation={true}
							setMultiLocation={this.setMultiLocation}
						/>
					)}
					{activePanel === WebviewPanels.NewReview && <ReviewForm />}
					{activePanel === WebviewPanels.NewCode && <CodeForm />}
					{activePanel === "channels" && (
						<ChannelPanel
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							setKnowledgeType={this.setKnowledgeType}
							setMultiCompose={this.setMultiCompose}
							runSlashCommand={this.runSlashCommand}
							isCodeStreamTeam={this.props.isCodeStreamTeam}
							teamProvider={this.props.teamProvider}
							services={this.props.services}
						/>
					)}
					{activePanel === "public-channels" && (
						<PublicChannelPanel
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							isCodeStreamTeam={this.props.isCodeStreamTeam}
						/>
					)}
					{activePanel === "create-channel" && (
						<CreateChannelPanel
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							isSlackTeam={this.props.teamProvider === "slack"}
						/>
					)}
					{activePanel === "create-dm" && (
						<CreateDMPanel
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							isSlackTeam={this.props.teamProvider === "slack"}
						/>
					)}
					{activePanel === WebviewPanels.Notifications && (
						<NotificationsPanel
							isCodeStreamTeam={this.props.isCodeStreamTeam}
							closePanel={this.props.closePanel}
						/>
					)}
					{activePanel === WebviewPanels.Status && (
						<StatusPanel closePanel={this.props.closePanel} />
					)}
					{(activePanel === WebviewPanels.People || activePanel === "invite") && (
						<TeamPanel
							activePanel={activePanel}
							setActivePanel={this.setActivePanel}
							isCodeStreamTeam={this.props.isCodeStreamTeam}
							teamProvider={this.props.teamProvider}
							teamPlan={this.props.team.plan}
							companyMemberCount={this.props.team.companyMemberCount}
						/>
					)}
					{activePanel === WebviewPanels.Tasks && (
						<TasksPanel activePanel={activePanel} setActivePanel={this.setActivePanel} />
					)}
					{activePanel.startsWith("configure-provider-youtrack-") && (
						<ConfigureYouTrackPanel
							providerId={configureProviderInfo[3]}
							originLocation={configureProviderInfo[4]}
						/>
					)}
					{activePanel.startsWith("configure-provider-azuredevops-") && (
						<ConfigureAzureDevOpsPanel
							providerId={configureProviderInfo[3]}
							originLocation={configureProviderInfo[4]}
						/>
					)}
					{activePanel.startsWith("configure-provider-jiraserver-") && (
						<ConfigureJiraServerPanel
							providerId={configureProviderInfo[3]}
							originLocation={configureProviderInfo[4]}
						/>
					)}
					{activePanel.startsWith("configure-enterprise-") && (
						<ConfigureEnterprisePanel
							providerId={configureProviderInfo[3]}
							originLocation={configureProviderInfo[4]}
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
												className={cx("smaller", {
													checked: postStreamStarred
												})}
											/>
										</span>
									</Tooltip>
									{memberCount > 0 && [
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
									{!postStreamPurpose && [
										<div className="sep" />,
										<span onClick={() => this.setPurpose()} className="purpose-header">
											Add a purpose
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
					{threadId && !this.props.currentCodemarkId && !onInlineCodemarks && (
						<div className="thread-panel" ref={ref => (this._threadPanel = ref)}>
							<div className="panel-header inline">
								<CancelButton title="Close thread" onClick={this.handleDismissThread} />
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
											isActive={
												this.props.activePanel === "thread" ||
												this.props.activePanel === WebviewPanels.Codemarks
											}
											hasFocus={this.props.hasFocus}
											teammates={this.props.teammates}
											currentUserId={this.props.currentUserId}
											currentUserName={this.props.currentUserName}
											editingPostId={this.state.editingPostId}
											postAction={this.postAction}
											streamId={this.props.postStreamId}
											isThread
											threadId={threadId}
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
				teamProvider={this.props.teamProvider}
				multiCompose={this.state.multiCompose}
				floatCompose={this.state.floatCompose}
				setMultiCompose={this.setMultiCompose}
				quotePost={this.state.quotePost}
				inThread={Boolean(this.props.threadId)}
				providerInfo={this.props.providerInfo}
				fetchIssueBoards={this.props.fetchIssueBoards}
				createTrelloCard={this.props.createTrelloCard}
				{...this.state.composeBoxProps}
			/>
		);
	};

	plusMenuAction = arg => {
		this.setState({ plusMenuOpen: false });
	};

	menuAction = arg => {
		this.setState({ menuOpen: false });

		if (!arg) return;

		if (arg.startsWith("configure-enterprise-") || arg.startsWith("configure-provider-")) {
			return this.setActivePanel(arg);
		}

		switch (arg) {
			case "invite":
				return this.setActivePanel(WebviewPanels.People);
			case "help":
				return this.handleClickHelpLink();
			case "feedback":
				return this.handleClickFeedbackLink();
			case "signout":
				return this.props.logout();
			default:
				return;
		}
	};

	toggleMenu = event => {
		this.setState({ menuOpen: !this.state.menuOpen, menuTarget: event.target.closest("label") });
	};

	togglePlusMenu = event => {
		this.setState({
			plusMenuOpen: !this.state.plusMenuOpen,
			menuTarget: event.target.closest("label")
		});
	};

	openCodemarkMenu = type => {
		this.setState({ knowledgeType: type, searchBarOpen: false });
		this.setActivePanel(WebviewPanels.Codemarks);
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
		this.setActivePanel(WebviewPanels.Codemarks);
		// this.setState({ searchBarOpen: !searchBarOpen, knowledgeType: "all" });
	};

	setContentScrollTop = value => {
		this._contentScrollDiv.scrollTop = value;
	};

	getContentScrollTop = () => {
		return this._contentScrollDiv.scrollTop;
	};

	setMultiCompose = async (value, state = {}, commentingContext) => {
		// ugly hack -Pez
		if (value == "collapse") {
			this.setState({ multiCompose: false, ...state });
		} else {
			this.props.setCurrentDocumentMarker(undefined);

			let scmInfo;
			if (commentingContext) {
				const { uri, range, setSelection } = commentingContext;
				if (setSelection) {
					HostApi.instance.send(EditorSelectRangeRequestType, {
						uri: uri,
						selection: { ...range, cursor: range.end },
						preserveFocus: true
					});
				}
				scmInfo = await HostApi.instance.send(GetRangeScmInfoRequestType, {
					uri: uri,
					range: range,
					dirty: true // should this be determined here? using true to be safe
				});
			}
			this.setState({
				multiCompose: value,
				floatCompose: true,
				composeBoxProps: { ...state, codeBlock: scmInfo }
			});
			if (!value) {
				this.props.setNewPostEntry(undefined);
				this.setState({
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
		if (activePanel === "thread" || activePanel === WebviewPanels.Codemarks) {
			list = this._threadpostslist;
		} else if (activePanel === "main") {
			list = this._postslist;
		}

		id = id || (list && list.getUsersMostRecentPost().id);
		if (id) {
			const { codemarks } = this.context.store.getState();

			const post = this.findPostById(id);

			if (post.codemarkId) {
				const codemark = getCodemark(codemarks, post.codemarkId);

				this.setMultiCompose(true, {
					...this.state.composeBoxProps,
					key: Math.random().toString(),
					isEditing: true,
					editingCodemark: codemark
				});
			} else
				this.setState({ editingPostId: post.id }, () => {
					if (list) {
						list.scrollTo(post.id);
					}
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
	handleDismissThread = () => {
		this.props.setCurrentStream(this.props.postStreamId);
		// this.setActivePanel("main");
		this.focusInput();
	};

	handleEditPost = event => {
		var postDiv = event.target.closest(".post");
		if (!postDiv) return;
		this.setState({ editingPostId: postDiv.id });
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

		this.handleDismissThread();
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

		if (this.props.isCodeStreamTeam) {
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

		const message = `Invite your teammates to give CodeStream a try by sharing this URL with them:\n\nhttps://app.codestream.com/invite?service=slack&amp;team=${this.props.teamId}`;
		return this.submitSystemPost(message);
	};

	postAction = (action, post, args) => {
		switch (action) {
			case "make-thread":
				return this.selectPost(post.id);
			case "goto-thread":
				return this.props.setCurrentStream(post.streamId, post.parentPostId || post.id);
			case "edit-post":
				return this.editLastPost(post.id);
			case "mark-unread":
				return this.markUnread(post.id);
			case "quote":
				return this.quotePost(post);
			case "add-reaction":
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
		this.selectPost(postDiv.id);
	};

	// show the thread related to the given post
	selectPost = id => {
		const post = this.findPostById(id);
		if (!post) return;

		// if it is a child in the thread, it'll have a parentPostId,
		// otherwise use the id. any post can become the head of a thread
		const threadId = post.parentPostId || post.id;
		this.props.setCurrentStream(post.streamId, threadId);
		this.focusInput();

		if (post.codemark && !this.props.threadId) {
			HostApi.track("Codemark Clicked", {
				"Codemark Location": "Stream",
				"Codemark ID": post.codemark.id
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
			if (this.props.isCodeStreamTeam) {
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
				if (this.props.isCodeStreamTeam) {
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
				if (this.props.isCodeStreamTeam) {
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
			if (this.props.isCodeStreamTeam) {
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

	submitNoCodeCodemark = async attributes => {
		const { type } = await this.props.createPostAndCodemark(attributes, "Global Nav");
		this.props.closePanel();
	};

	submitCodemark = async (attributes, crossPostIssueValues, scmInfo) => {
		if (this.state.composeBoxProps.isEditing) {
			this.props.editCodemark(this.state.composeBoxProps.editingCodemark.id, {
				// color: attributes.color,
				text: attributes.text,
				title: attributes.title,
				assignees: attributes.assignees,
				tags: attributes.tags,
				relatedCodemarkIds: attributes.relatedCodemarkIds
			});
			return this.setMultiCompose(false);
		} else {
			const submit = async markers => {
				// temporarily prevent codemarks as replies...
				const threadId = undefined;
				await this.props.createPost(
					attributes.streamId,
					threadId,
					null,
					{ ...attributes, markers, textEditorUri: scmInfo.uri },
					this.findMentionedUserIds(attributes.text || "", this.props.teammates),
					{ crossPostIssueValues }
				);
				if (attributes.streamId !== this.props.postStreamId) {
					this.props.setCurrentStream(attributes.streamId);
				} else this.setMultiCompose(false);
				// this.setActivePanel("main");
				safe(() => this.scrollPostsListToBottom());
			};
			if (!scmInfo) return submit([]);

			let marker = {
				code: scmInfo.contents,
				range: scmInfo.range
			};

			if (scmInfo.scm) {
				marker.file = scmInfo.scm.file;
				marker.source = scmInfo.scm;
			}
			const markers = [marker];

			let warning;
			if (isNotOnDisk(scmInfo.uri))
				warning = {
					title: "Unsaved File",
					message:
						"Your teammates won't be able to see the codemark when viewing this file unless you save the file first."
				};
			else {
				switch (getFileScmError(scmInfo)) {
					case "NoRepo": {
						warning = {
							title: "Missing Git Info",
							message: `This repo doesn’t appear to be tracked by Git. Your teammates won’t be able to see the codemark when viewing this source file.\n\n${uriToFilePath(
								scmInfo.uri
							)}`
						};
						break;
					}
					case "NoRemotes": {
						warning = {
							title: "No Remote URL",
							message:
								"This repo doesn’t have a remote URL configured. Your teammates won’t be able to see the codemark when viewing this source file."
						};
						break;
					}
					case "NoGit": {
						warning = {
							title: "Git could not be located",
							message:
								"CodeStream was unable to find the `git` command. Make sure it's installed and configured properly."
						};
						break;
					}
					default: {
					}
				}
			}

			if (warning) {
				return confirmPopup({
					title: warning.title,
					message: () => (
						<span>
							{warning.message + " "}
							<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Git-Issues">Learn more</a>
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
				assignees: codemark.assignees,
				tags: codemark.tags,
				relatedCodemarkIds: codemark.relatedCodemarkIds
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
						"This repo doesn’t appear to be tracked by Git. When your teammates view this post, we won’t be able to connect the code block to the appropriate file in their IDE."
				};
			}

			if (warning) {
				return confirmPopup({
					title: warning.title,
					message: () => (
						<span>
							{warning.message + " "}
							<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Git-Issues">Learn more</a>
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

/**
 * @param {Object} state
 * @param {Object} state.capabilities
 * @param {Object} state.configs
 * @param {Object} state.connectivity
 * @param {ContextState} state.context
 * @param {Object} state.editorContext
 * @param {Object} state.pluginVersion
 * @param {Object} state.posts
 * @param {Object} state.preferences
 * @param {Object} state.providers
 * @param {Object} state.services
 * @param {Object} state.session
 * @param {Object} state.streams
 * @param {Object} state.teams
 * @param {Object} state.umis
 * @param {Object} state.users
 **/
const mapStateToProps = state => {
	const {
		apiVersioning,
		capabilities,
		configs,
		connectivity,
		context,
		pluginVersion,
		posts,
		preferences,
		providers,
		services,
		session,
		streams,
		teams,
		umis,
		users
	} = state;

	const team = teams[context.currentTeamId];
	const teamProvider = getTeamProvider(team);
	const teamMembers = getTeamMembers(state);

	const isOffline = connectivity.offline;

	// FIXME -- eventually we'll allow the user to switch to other streams, like DMs and channels
	const teamStream = getStreamForTeam(streams, context.currentTeamId) || {};
	const postStream =
		getStreamForId(streams, context.currentTeamId, context.currentStreamId) || teamStream;
	const streamPosts = getPostsForStream(state, postStream.id);

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

	const channelStreams = getChannelStreamsForTeam(state, context.currentTeamId);

	const directMessageStreams = (
		getDirectMessageStreamsForTeam(streams, context.currentTeamId) || []
	).map(stream => ({
		...stream,
		name: getDMName(stream, teamMembersById, session.userId)
	}));

	return {
		inSharingModel: state.featureFlags.sharing,
		apiCapabilities: apiVersioning.apiCapabilities,
		currentCodemarkId: context.currentCodemarkId,
		currentMarkerId: context.currentMarkerId,
		currentReviewId: context.currentReviewId,
		capabilities: capabilities,
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
		muteAll: context.channelsMuteAll,
		currentDocumentMarkerId: context.currentDocumentMarkerId,
		postStream,
		postStreamId: postStream.id,
		postStreamName,
		postStreamPurpose: postStream.purpose,
		postStreamType: postStream.type,
		postStreamIsTeamStream: postStream.isTeamStream,
		postStreamMemberIds: postStream.memberIds,
		providerInfo,
		providers,
		isPrivate: postStream.privacy === "private",
		teamId: context.currentTeamId,
		teamName: team.name || "",
		repoId: context.currentRepoId,
		hasFocus: context.hasFocus,
		currentUserId: user.id,
		currentUserName: user.username,
		currentUserEmail: user.email,
		mutedStreams: preferences.mutedStreams || {},
		starredStreams: preferences.starredStreams || {},
		slashCommands: getSlashCommands(capabilities),
		userTeams: _sortBy(
			Object.values(teams).filter(t => !t.deactivated),
			"name"
		),
		team: team,
		teamProvider: teamProvider,
		isCodeStreamTeam: teamProvider === "codestream",
		channelMembers,
		services,
		isInVscode: state.ide.name === "VSC",
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

export default connect(mapStateToProps, {
	...actions,
	setCurrentReview,
	setCurrentStream,
	editCodemark,
	setNewPostEntry,
	logout,
	switchToTeam
})(injectIntl(SimpleStream));
