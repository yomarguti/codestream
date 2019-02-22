import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import _ from "underscore";
import {
	changeStreamMuteState,
	closeDirectMessage,
	createStream,
	setUserPreference,
	setChannelFilter,
	openPanel
} from "./actions";
import { setCurrentStream } from "../store/context/actions";
import {
	getChannelStreamsForTeam,
	getDirectMessageStreamsForTeam,
	getServiceStreamsForTeam,
	getDMName
} from "../store/streams/reducer";
import { mapFilter, toMapBy } from "../utils";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import Debug from "./Debug";
import Button from "./Button";
import ChannelMenu from "./ChannelMenu";
import ScrollBox from "./ScrollBox";
import Filter from "./Filter";
import { isInVscode, safe } from "../utils";
import VsCodeKeystrokeDispatcher from "../utilities/vscode-keystroke-dispatcher";
import { MuteAllConversationsRequestType } from "../ipc/webview.protocol";
import { HostApi } from "../webview-api";

export class SimpleChannelPanel extends Component {
	constructor(props) {
		super(props);

		this.state = {
			expanded: {
				knowledgeBase: true,
				teamChannels: true,
				unreadChannels: true,
				starredChannels: true,
				directMessages: true,
				liveShareSessions: true,
				unreads: true
			},
			checkedStreams: {}
		};
		this.showChannelsLabel = {
			all: "all conversations",
			"unreads-starred": "unread & starred conversations",
			unreads: "unread conversations",
			selected: "selected conversations"
		};
		this.menuItems = [
			{ label: "All Conversations", action: "all" },
			{ label: "Unread & Starred Conversations", action: "unreads-starred" },
			{ label: "Unread Conversations", action: "unreads" },
			{ label: "-" },
			{ label: "Selected Conversations", action: "selecting" }
		];
	}

	static getDerivedStateFromProps(props, state) {
		if (
			props.showChannels !== "selecting" &&
			props.showChannels !== state.previousShowChannelsValue
		) {
			return { previousShowChannelsValue: props.showChannels };
		}
		return null;
	}

	componentDidMount() {
		if (isInVscode()) {
			this.disposable = VsCodeKeystrokeDispatcher.on("keydown", event => {
				if (event.key === "Escape") {
					this.props.setChannelFilter(this.state.previousShowChannelsValue);
				}
			});
		}
	}

	componentDidUpdate(prevProps, prevState) {
		if (this.props.showChannels === "selecting" && prevProps.showChannels !== "selecting")
			this.setState({ checkedStreams: this.props.selectedStreams });
	}

	render() {
		const { showChannels } = this.props;

		if (showChannels === "selecting") return this.renderSelectingChannels();

		return (
			<div
				className={createClassString("panel", "channel-panel", {
					muted: this.props.muteAll
				})}
			>
				{
					//<div className="panel-header">Channels &amp; DMs</div>
				}
				<div className="filters">
					<Tooltip title="Mute All" placement="left">
						<label
							htmlFor="toggle"
							className={createClassString("switch", {
								checked: !this.props.muteAll
							})}
							onClick={this.toggleMuteAll}
						/>
					</Tooltip>
					Show{" "}
					<Filter
						onValue={this.props.setChannelFilter}
						selected={showChannels}
						labels={this.showChannelsLabel}
						items={this.menuItems}
					/>
				</div>
				<ScrollBox>
					<div className="channel-list vscroll">{this.renderChannels()}</div>
				</ScrollBox>
			</div>
		);
	}

	renderChannels = () => {
		switch (this.props.showChannels) {
			case "unreads-starred":
				return [this.renderUnreadChannels(), this.renderStarredChannels()];
			case "unreads":
				return this.renderUnreadChannels();
			case "selecting":
				return this.renderSelectingChannels();
			case "selected":
				return this.renderSelectedChannels();
			default:
				return [
					// this.renderUnreadChannels(),
					this.renderStarredChannels(),
					this.renderTeamChannels(),
					this.renderDirectMessages(),
					this.renderServiceChannels()
				];
		}
	};

	toggleMuteAll = () => {
		HostApi.instance.send(MuteAllConversationsRequestType, { mute: !this.props.muteAll });
	};

	toggleMenu = event => {
		this.setState({ menuOpen: !this.state.menuOpen, menuTarget: event.target });
	};

	toggleSection = (e, section) => {
		e.stopPropagation();
		this.setState({
			expanded: { ...this.state.expanded, [section]: !this.state.expanded[section] }
		});
	};

	renderBrowsePublicIcon = () => {
		if (this.props.isSlackTeam) return null;

		return (
			<Tooltip title="Browse Public Channels" placement="bottomRight">
				<span>
					<Icon name="list-unordered" onClick={this.handleClickShowPublicChannels} />
				</span>
			</Tooltip>
		);
	};

	renderCreateChannelIcon = () => {
		return (
			<Tooltip title="Create a Channel" placement="bottomRight">
				<span>
					<Icon name="plus" onClick={this.handleClickCreateChannel} />
				</span>
			</Tooltip>
		);
	};

	renderCreateDMIcon = () => {
		return (
			<Tooltip title="Create a DM" placement="bottomRight">
				<span>
					<Icon name="plus" onClick={this.handleClickCreateDirectMessage} />
				</span>
			</Tooltip>
		);
	};

	renderUnreadChannels = () => {
		return (
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded["unreadChannels"]
				})}
			>
				<div className="header top" onClick={e => this.toggleSection(e, "unreadChannels")}>
					<Icon name="triangle-right" className="triangle-right" />
					<span className="clickable">Unread</span>
					<div className="align-right">
						{this.renderBrowsePublicIcon()}
						{this.renderCreateChannelIcon()}
						{this.renderCreateDMIcon()}
					</div>
				</div>
				<ul onClick={this.handleClickSelectStream}>
					{this.renderStreams(this.props.channelStreams, { unreadsOnly: true })}
					{this.renderStreams(this.props.directMessageStreams, { unreadsOnly: true })}
				</ul>
			</div>
		);
	};

	renderStarredChannels = () => {
		const { starredStreams } = this.props;
		if (starredStreams.length === 0) return null;
		return (
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded["starredChannels"]
				})}
			>
				<div className="header top" onClick={e => this.toggleSection(e, "starredChannels")}>
					<Icon name="triangle-right" className="triangle-right" />
					<span className="clickable">Starred</span>
					<div className="align-right">
						{this.renderBrowsePublicIcon()}
						{this.renderCreateChannelIcon()}
						{this.renderCreateDMIcon()}
					</div>
				</div>
				<ul onClick={this.handleClickSelectStream}>
					{this.renderStreams(this.props.starredStreams)}
				</ul>
			</div>
		);
	};

	renderSelectedChannels = () => {
		return [
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded["teamChannels"]
				})}
				key="one"
			>
				<div className="header top" onClick={e => this.toggleSection(e, "teamChannels")}>
					<Icon name="triangle-right" className="triangle-right" />
					<span className="clickable">Channels</span>
					<div className="align-right">
						{this.renderBrowsePublicIcon()}
						{this.renderCreateChannelIcon()}
					</div>
				</div>
				<ul onClick={this.handleClickSelectStream}>
					{this.renderStreams(this.props.channelStreams, { selectedOnly: true })}
				</ul>
			</div>,
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded["directMessages"]
				})}
				key="two"
			>
				<div className="header top" onClick={e => this.toggleSection(e, "directMessages")}>
					<Icon name="triangle-right" className="triangle-right" />
					<span className="clickable">Direct Messages</span>
					<div className="align-right">{this.renderCreateDMIcon()}</div>
				</div>
				<ul onClick={this.handleClickSelectStream}>
					{this.renderStreams(this.props.directMessageStreams, { selectedOnly: true })}
				</ul>
			</div>
		];
	};

	renderSelectingChannels = () => {
		const title = (
			<span>
				Close <span className="keybinding">ESC</span>
			</span>
		);
		return (
			<div className="panel select-channels">
				<div className="panel-header">
					<Tooltip title={title} placement="bottomRight">
						<span
							className="align-right-button"
							onClick={() => this.props.setChannelFilter(this.state.previousShowChannelsValue)}
						>
							<Icon name="x" className="clickable" />
						</span>
					</Tooltip>
					Select Channels to Show
				</div>
				<ScrollBox>
					<form className="standard-form vscroll">
						<fieldset className="form-body">
							<ul>
								{this.renderStreamsCheckboxes(this.props.channelStreams)}
								{this.renderStreamsCheckboxes(this.props.directMessageStreams)}
							</ul>
							<div className="button-group">
								<Button className="control-button cancel" onClick={this.selectAll}>
									Select All
								</Button>
								<Button className="control-button cancel" onClick={this.selectNone}>
									Select None
								</Button>
								<Button className="control-button" onClick={this.saveSelected}>
									Save
								</Button>
							</div>
						</fieldset>
					</form>
				</ScrollBox>
			</div>
		);
	};

	selectAll = event => {
		event.preventDefault();
		let checkedStreams = {};
		this.props.channelStreams.forEach(stream => (checkedStreams[stream.id] = true));
		this.props.directMessageStreams.forEach(stream => (checkedStreams[stream.id] = true));
		this.setState({ checkedStreams });
	};

	selectNone = event => {
		event.preventDefault();
		this.setState({ checkedStreams: {} });
	};

	saveSelected = async event => {
		event.preventDefault();
		const { checkedStreams } = this.state;
		await Promise.all([
			this.props.setUserPreference(["selectedStreams"], checkedStreams),
			this.props.setChannelFilter("selected")
		]);
	};

	streamIcon = stream => {
		if (stream.type === "direct") {
			return stream.name === "slackbot" ? (
				<Icon className="heart" name="heart" />
			) : safe(() => stream.memberIds.length > 2) ? (
				<Icon className="organization" name="organization" />
			) : (
				<Icon className="person" name="person" />
			);
		}
		return this.props.mutedStreams[stream.id] ? (
			<Icon className="mute" name="mute" />
		) : stream.privacy === "private" ? (
			<Icon className="lock" name="lock" />
		) : stream.serviceType === "vsls" ? (
			<Icon className="broadcast" name="broadcast" />
		) : (
			<span className="icon hash">#</span>
		);
	};

	renderStreamsCheckboxes = streams => {
		return streams.map(stream => {
			if (stream.isArchived) return null;
			return (
				<li key={stream.id} id={stream.id}>
					<input
						checked={this.state.checkedStreams[stream.id]}
						type="checkbox"
						id={"channel-" + stream.id}
						onChange={e => this.checkStream(stream.id)}
					/>
					&nbsp;
					<label htmlFor={"channel-" + stream.id}>
						{this.streamIcon(stream)}
						{stream.name}
					</label>
				</li>
			);
		});
	};

	checkStream = streamId => {
		const { checkedStreams } = this.state;
		this.setState({ checkedStreams: { ...checkedStreams, [streamId]: !checkedStreams[streamId] } });
	};

	renderTeamChannels = () => {
		return (
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded["teamChannels"]
				})}
			>
				<div className="header top" onClick={e => this.toggleSection(e, "teamChannels")}>
					<Icon name="triangle-right" className="triangle-right" />
					<span className="clickable">Channels</span>
					<div className="align-right">
						{this.renderBrowsePublicIcon()}
						{this.renderCreateChannelIcon()}
					</div>
				</div>
				<ul onClick={this.handleClickSelectStream}>
					{this.renderStreams(this.props.channelStreams)}
				</ul>
			</div>
		);
	};

	renderServiceChannels = () => {
		if (this.props.serviceStreams.length === 0) return null;

		return (
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded["liveShareSessions"]
				})}
			>
				<div className="header" onClick={e => this.toggleSection(e, "liveShareSessions")}>
					<Icon name="triangle-right" className="triangle-right" />
					<span className="clickable">Live Share Sessions</span>
				</div>
				<ul onClick={this.handleClickSelectStream}>
					{this.renderStreams(this.props.serviceStreams)}
				</ul>
			</div>
		);
	};

	renderStreams = (streams, { unreadsOnly, starredOnly, selectedOnly } = {}) => {
		const { selectedStreams } = this.props;

		return streams.map(stream => {
			if (stream.isArchived) return null;

			// FIXME remove this line once we're sure there are no PROD streams of this type
			// no new ones are being created
			if (stream.name.match(/^ls:/)) return null;

			let count = this.props.umis.unreads[stream.id] || 0;
			if (this.props.mutedStreams[stream.id]) count = 0;
			let mentions = this.props.umis.mentions[stream.id] || 0;
			let menuActive = this.state.openMenu === stream.id;
			if (unreadsOnly && count == 0 && mentions == 0) return;
			if (selectedOnly && !selectedStreams[stream.id]) return;
			return (
				<li
					className={createClassString({
						active: menuActive ? true : false,
						muted: this.props.mutedStreams[stream.id],
						unread: count > 0
					})}
					key={stream.id}
					id={stream.id}
				>
					{this.streamIcon(stream)}
					<Debug text={stream.id}>{stream.name}</Debug>
					{mentions > 0 && <span className="umi">{mentions}</span>}
					{mentions == 0 && (
						<span className="align-right">
							{this.props.services.vsls && (
								<Tooltip title="Start a Live Share" placement="bottomRight">
									<span>
										<Icon name="link-external" onClick={this.handleClickStartLiveShare} />
									</span>
								</Tooltip>
							)}
							<Icon name="gear" onClick={this.handleClickStreamSettings} />
							{menuActive && (
								<ChannelMenu
									stream={stream}
									target={this.state.menuTarget}
									umiCount={count}
									isMuted={this.props.mutedStreams[stream.id]}
									setActivePanel={this.props.setActivePanel}
									runSlashCommand={this.props.runSlashCommand}
									closeMenu={this.closeMenu}
								/>
							)}
						</span>
					)}
				</li>
			);
		});
	};

	renderDirectMessages = () => {
		const now = new Date().getTime();
		const futureTimestamp = 32503698000000; // Jan 1, 3000

		let canUseTimestamp = true;
		let dms = mapFilter(this.props.directMessageStreams, stream => {
			let count = this.props.umis.unreads[stream.id] || 0;
			// let mentions = this.props.umis.mentions[stream.id] || 0;
			if (this.props.mutedStreams[stream.id]) {
				// if you have muted a stream, check to see if there is a UMI.
				// if so, unmute the stream. if not, don't display it.
				if (count) this.props.changeStreamMuteState(stream.id, false);
				else return null;
			}

			let icon;
			if (stream.name === "slackbot") {
				icon = <Icon className="heart active" name="heart" />;
			} else if (stream.memberIds == null || stream.memberIds.length > 2) {
				icon = <Icon className="organization" name="organization" />;
			} else {
				const presence = this.props.streamPresence[stream.id];
				if (presence) {
					const className = `person ${presence}`;
					icon = <Icon className={className} name="person" />;
				} else {
					icon = <Icon className="person" name="person" />;
				}
			}

			const isMeStream = stream.id === this.props.meStreamId;

			let sortName;
			let sortPriority;
			let sortTimestamp;
			if (this.props.isSlackTeam) {
				sortTimestamp = stream.mostRecentPostCreatedAt;
				if (sortTimestamp == null) {
					canUseTimestamp = false;
				}
				sortPriority = stream.priority;

				if (stream.name === "slackbot") {
					sortTimestamp = futureTimestamp + 1;
					sortPriority = 100;
					sortName = ".";
				} else if (isMeStream) {
					sortTimestamp = futureTimestamp;
					sortPriority = 99;
					sortName = "..";
				} else {
					sortName = stream.name ? stream.name.toLowerCase() : "";
				}

				if (count) {
					sortPriority += 1;
					if (sortTimestamp != null) {
						sortTimestamp = now + (now - sortTimestamp);
					}
				}
			} else {
				sortTimestamp = isMeStream
					? futureTimestamp
					: stream.mostRecentPostCreatedAt || stream.modifiedAt || 1;
				sortPriority = 0;

				if (isMeStream) {
					sortName = "..";
				} else {
					sortName = stream.name ? stream.name.toLowerCase() : "";
				}

				if (count) {
					if (sortTimestamp != null) {
						sortTimestamp = now + (now - sortTimestamp);
					}
				}
			}

			return {
				sortName,
				sortPriority,
				sortTimestamp,
				element: (
					<li
						className={createClassString({
							direct: true,
							unread: count > 0
						})}
						key={stream.id}
						id={stream.id}
					>
						<Debug text={stream.id}>
							{icon}
							{stream.name} {isMeStream && <span className="you"> (you)</span>}
							{count > 0 && <span className="umi">{count}</span>}
							{count == 0 && (
								<span className="align-right">
									{this.props.services.vsls && (
										<Tooltip title="Start a Live Share" placement="bottomRight">
											<span>
												<Icon name="link-external" onClick={this.handleClickStartLiveShare} />
											</span>
										</Tooltip>
									)}
									<Icon name="x" onClick={this.handleClickCloseDirectMessage} />
								</span>
							)}
						</Debug>
					</li>
				)
			};
		});

		// Sort the streams by our best priority guess, then truncate and sort alphabetically
		if (canUseTimestamp) {
			dms.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
		} else {
			dms.sort((a, b) => a.sortPriority - b.sortPriority);
		}
		dms = dms.slice(0, 20);
		dms.sort((a, b) => a.sortName.localeCompare(b.sortName));

		return (
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded["directMessages"]
				})}
			>
				<div className="header" onClick={e => this.toggleSection(e, "directMessages")}>
					<Icon name="triangle-right" className="triangle-right" />
					<span className="clickable">Direct Messages</span>
					<div className="align-right">
						<Tooltip title="Open a direct message" placement="bottomRight">
							<span>
								<Icon name="plus" onClick={this.handleClickCreateDirectMessage} />
							</span>
						</Tooltip>
					</div>
				</div>
				<ul onClick={this.handleClickSelectStream}>
					{dms.map(stream => stream.element)}
					<li
						className="invite"
						onClick={event => {
							event.stopPropagation();
							this.props.openPanel("invite");
						}}
					>
						<span>
							<Icon name="plus-small" />
							{this.props.isSlackTeam ? "Invite People to CodeStream" : "Invite People"}
						</span>
					</li>
				</ul>
			</div>
		);
	};

	handleClickStartLiveShare = event => {
		this.handleClickSelectStream(event);
		setTimeout(() => {
			this.props.runSlashCommand("liveshare", { startLocation: "Channel Switcher" });
		}, 500);
	};

	handleClickCreateKnowledge = e => {
		e.stopPropagation();
		this.props.setMultiCompose(true);
		// this.props.setActivePanel("main");
		// setTimeout(() => {
		// 	this.props.runSlashCommand("multi-compose");
		// }, 500);
		return;
	};

	handleClickSelectStream = event => {
		event.preventDefault();
		var liDiv = event.target.closest("li");
		if (!liDiv) return; // FIXME throw error
		if (liDiv.id) {
			this.props.setActivePanel("main");
			this.props.setCurrentStream(liDiv.id);
		} else if (liDiv.getAttribute("teammate")) {
			this.props.createStream({ type: "direct", memberIds: [liDiv.getAttribute("teammate")] });
		} else {
			console.log("Unknown LI in handleClickSelectStream: ", event);
		}
	};

	handleClickSelectKnowledge = event => {
		event.preventDefault();
		var liDiv = event.target.closest("li");
		if (!liDiv) return; // FIXME throw error
		if (liDiv.id) {
			this.props.setActivePanel("knowledge");
			this.props.setKnowledgeType(liDiv.id);
		} else {
			console.log("Unknown LI in handleClickSelectKnowledge: ", event);
		}
	};

	handleClickCreateChannel = e => {
		e.stopPropagation();
		this.props.setActivePanel("create-channel");
	};

	handleClickShowPublicChannels = e => {
		e.stopPropagation();
		this.props.setActivePanel("public-channels");
	};

	handleClickCreateDirectMessage = e => {
		e.stopPropagation();
		this.props.setActivePanel("create-dm");
	};

	handleClickStreamSettings = event => {
		var liDiv = event.target.closest("li");
		if (!liDiv || !liDiv.id) return; // FIXME throw error
		this.setState({ openMenu: liDiv.id, menuTarget: event.target });
		event.stopPropagation();
		return true;
	};

	handleClickCloseDirectMessage = event => {
		event.stopPropagation();
		var liDiv = event.target.closest("li");
		if (!liDiv) return; // FIXME throw error
		const id = liDiv.id || liDiv.getAttribute("teammate");
		this.props.closeDirectMessage(id);
	};

	findStream = streamId => {
		return (
			this.props.channelStreams.find(stream => stream.id === streamId) ||
			this.props.directMessageStreams.find(stream => stream.id === streamId)
		);
	};

	closeMenu = () => {
		this.setState({ openMenu: null });
	};
}

const EMPTY_OBJECT = Object.freeze({});

const mapStateToProps = ({
	configs,
	context,
	preferences,
	streams,
	users,
	teams,
	umis,
	session
}) => {
	const team = teams[context.currentTeamId];

	const teamMembers = team.memberIds.map(id => users[id]).filter(Boolean);
	// .filter(user => user && user.isRegistered);

	const channelStreams = _.sortBy(
		getChannelStreamsForTeam(streams, context.currentTeamId, session.userId) || [],
		stream => (stream.name || "").toLowerCase()
	);

	let meStreamId;
	let streamPresence = Object.create(null);

	const directMessageStreams = mapFilter(
		getDirectMessageStreamsForTeam(streams, context.currentTeamId) || [],
		stream => {
			if (
				stream.isClosed ||
				(stream.memberIds != null &&
					stream.memberIds.some(id => users[id] != null && users[id].deactivated))
			) {
				return;
			}

			if (stream.memberIds != null && stream.memberIds.length <= 2) {
				// this is my stream with myself, if it exists
				if (stream.memberIds.length === 1 && stream.memberIds[0] === session.userId) {
					meStreamId = stream.id;
					streamPresence[stream.id] = users[session.userId].presence;
				} else {
					const id = stream.memberIds[stream.memberIds[0] === session.userId ? 1 : 0];
					const user = users[id];
					if (user !== undefined) {
						streamPresence[stream.id] = user.presence;
					}
				}
			}

			return {
				...stream,
				name: getDMName(stream, toMapBy("id", teamMembers), session.userId)
			};
		}
	);

	const serviceStreams = _.sortBy(
		getServiceStreamsForTeam(streams, context.currentTeamId, session.userId, users) || [],
		stream => -stream.createdAt
	);

	const starredStreamIds = preferences.starredStreams || EMPTY_OBJECT;
	const starredStreams = [...channelStreams, ...directMessageStreams].filter(stream => {
		return starredStreamIds[stream.id];
	});

	return {
		umis,
		users,
		channelStreams,
		directMessageStreams,
		serviceStreams,
		muteAll: configs.muteAll,
		mutedStreams: preferences.mutedStreams || EMPTY_OBJECT,
		starredStreams: starredStreams,
		selectedStreams: preferences.selectedStreams || EMPTY_OBJECT,
		meStreamId,
		streamPresence,
		team: team,
		showChannels: context.channelFilter
	};
};

export default connect(
	mapStateToProps,
	{
		changeStreamMuteState,
		closeDirectMessage,
		createStream,
		setUserPreference,
		setCurrentStream,
		openPanel,
		setChannelFilter
	}
)(SimpleChannelPanel);
