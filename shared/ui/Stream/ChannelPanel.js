import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import _ from "underscore";
import { createStream, setCurrentStream, setUserPreference } from "./actions";
import {
	getChannelStreamsForTeam,
	getDirectMessageStreamsForTeam,
	getServiceStreamsForTeam,
	getDMName
} from "../reducers/streams";
import { toMapBy } from "../utils";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import ChannelMenu from "./ChannelMenu";

export class SimpleChannelPanel extends Component {
	constructor(props) {
		super(props);

		this.state = {
			expanded: {
				teamChannels: true,
				directMessages: true,
				liveShareSessions: true,
				unreads: true
			}
		};
		this._channelPanel = React.createRef();
	}

	render() {
		const teamName = this.props.team ? this.props.team.name : "";

		const channelPanelClass = createClassString({
			panel: true,
			"channel-panel": true,
			shrink: this.props.activePanel !== "channels"
		});

		return (
			<div className={channelPanelClass} ref={this._channelPanel}>
				<div className="panel-header">
					<span className="panel-title">{teamName}</span>
				</div>
				<div className="shadow-overlay">
					<div className="shadow-container">
						<div className="shadow shadow-top" />
						<div className="shadow shadow-bottom" />
					</div>
					<div className="channel-list vscroll">
						{this.renderUnreadChannels()}
						{this.renderTeamChannels()}
						{this.renderDirectMessages()}
						{this.renderServiceChannels()}
						<div class="shadow-cover-bottom" />
					</div>
				</div>
			</div>
		);
	}

	toggleSection = (e, section) => {
		e.stopPropagation();
		this.setState({
			expanded: { ...this.state.expanded, [section]: !this.state.expanded[section] }
		});
	};

	renderUnreadChannels = () => {
		return;
		// return (
		// 	<div className="section">
		// 		<div className="header">
		// 			<Tooltip title="All Channels With Unread Messages" placement="left" delay="0.5">
		// 				<span className="clickable">UNREADS</span>
		// 			</Tooltip>
		// 		</div>
		// 		<ul onClick={this.handleClickSelectStream}>
		// 			{this.renderStreams(this.props.channelStreams)}
		// 		</ul>
		// 	</div>
		// );
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
						<Tooltip title="Browse all Channels" placement="bottom" delay="0.5">
							<span>
								<Icon name="list-unordered" onClick={this.handleClickShowPublicChannels} />
							</span>
						</Tooltip>
						<Tooltip title="Create a Channel" placement="bottom" delay="0.5">
							<span>
								<Icon name="plus" onClick={this.handleClickCreateChannel} />
							</span>
						</Tooltip>
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

	renderStreams = streams => {
		return streams.map(stream => {
			if (stream.isArchived) return null;

			// FIXME remove this line once we're sure there are no PROD streams of this type
			// no new ones are being created
			if (stream.name.match(/^ls:/)) return null;

			const icon = this.props.mutedStreams[stream.id] ? (
				<Icon className="mute" name="mute" />
			) : stream.privacy === "private" ? (
				<Icon className="lock" name="lock" />
			) : stream.serviceType === "vsls" ? (
				<Icon className="broadcast" name="broadcast" />
			) : (
				<span className="icon hash">#</span>
			);
			let count = this.props.umis.unread[stream.id] || 0;
			if (this.props.mutedStreams[stream.id]) count = 0;
			let mentions = this.props.umis.mentions[stream.id] || 0;
			let menuActive = this.state.openMenu === stream.id;
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
					{icon}
					{stream.name}
					{mentions > 0 ? <span className="umi">{mentions}</span> : null}
					<span>
						<Tooltip title="Channel Settings">
							<Icon name="gear" className="align-right" onClick={this.handleClickStreamSettings} />
						</Tooltip>
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
				</li>
			);
		});
	};

	renderDirectMessages = () => {
		let unsortedStreams = this.props.directMessageStreams
			.map(stream => {
				let count = this.props.umis.unread[stream.id] || 0;
				// let mentions = this.props.umis.mentions[stream.id] || 0;
				if (this.props.mutedStreams[stream.id]) {
					// if you have muted a stream, check to see if there is a UMI.
					// if so, unmute the stream. if not, don't display it.
					if (count) this.props.setUserPreference(["mutedStreams", stream.id], false);
					else return null;
				}

				const icon =
					stream.memberIds.length > 2 ? (
						<Icon className="organization" name="organization" />
					) : (
						<Icon className="person" name="person" />
					);
				const sortTimestamp =
					stream.name === "slackbot"
						? 1
						: stream.isMeStream
							? 2
							: stream.mostRecentPostCreatedAt || stream.modifiedAt || 528593114636;
				const sortName =
					stream.name === "slackbot"
						? "."
						: stream.isMeStream
							? ".."
							: (stream.name || "").toLowerCase();

				return {
					sortName,
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
							{icon}
							{stream.name}
							{count > 0 ? <span className="umi">{count}</span> : null}
							<Tooltip title="Close Conversation">
								<Icon name="x" onClick={this.handleClickMuteStream} className="align-right" />
							</Tooltip>
						</li>
					)
				};
			})
			.filter(Boolean);

		unsortedStreams = unsortedStreams.concat(
			this.props.teammates
				.map(teammate => {
					if (_.contains(this.props.oneOnOnePeople, teammate.id)) return null;
					if (this.props.mutedStreams[teammate.id]) return null;
					if (!teammate.isRegistered) return null;
					const name = teammate.username || teammate.fullName || "";
					return {
						name: name.toLowerCase(),
						element: (
							<li key={teammate.id} teammate={teammate.id}>
								<Icon className="person" name="person" />
								<span className="name">{name}</span>
								<Tooltip title="Close Conversation">
									<Icon name="x" onClick={this.handleClickMuteStream} className="align-right" />
								</Tooltip>
							</li>
						)
					};
				})
				.filter(Boolean)
		);

		const recentStreams = _.sortBy(unsortedStreams, x => x.sortTimestamp).slice(0, 20);

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
						<Tooltip title="Open a direct message" placement="bottom" delay="0.5">
							<span>
								<Icon name="plus" onClick={this.handleClickCreateDirectMessage} />
							</span>
						</Tooltip>
					</div>
				</div>
				<ul onClick={this.handleClickSelectStream}>
					{_.sortBy(recentStreams, stream => stream.sortName).map(stream => stream.element)}
					<li className="invite" onClick={() => this.props.setActivePanel("invite")}>
						<span>
							<Icon name="plus-small" />
							{this.props.isCodeStreamTeam ? "Invite People" : "Invite People to CodeStream"}
						</span>
					</li>
				</ul>
			</div>
		);
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

	handleClickMuteStream = event => {
		var liDiv = event.target.closest("li");
		if (!liDiv) return; // FIXME throw error
		const id = liDiv.id || liDiv.getAttribute("teammate");
		this.props.setUserPreference(["mutedStreams", id], !this.props.mutedStreams[id]);
		event.stopPropagation();
		return true;
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

const mapStateToProps = ({ context, streams, users, teams, umis, session }) => {
	const teamMembers = teams[context.currentTeamId].memberIds.map(id => users[id]).filter(Boolean);
	// .filter(user => user && user.isRegistered);

	const channelStreams = _.sortBy(
		getChannelStreamsForTeam(streams, context.currentTeamId, session.userId) || [],
		stream => (stream.name || "").toLowerCase()
	);

	const user = users[session.userId];
	const mutedStreams = (user && user.preferences && user.preferences.mutedStreams) || {};

	const directMessageStreams = (
		getDirectMessageStreamsForTeam(streams, context.currentTeamId) || []
	).map(stream => ({
		...stream,
		name: getDMName(stream, toMapBy("id", teamMembers), session.userId)
	}));

	const serviceStreams = _.sortBy(
		getServiceStreamsForTeam(streams, context.currentTeamId, session.userId, users) || [],
		stream => -stream.createdAt
	);

	// get a list of the users i have 1:1 streams with
	const oneOnOnePeople = directMessageStreams
		.map(stream => {
			const notMe = _.without(stream.memberIds || [], session.userId);
			if (notMe.length === 1) return notMe[0];

			// this is my stream with myself, if it exists
			if (stream.memberIds.length === 1 && stream.memberIds[0] === session.userId) {
				stream.isMeStream = true;
				return session.userId;
			}
			return;
		})
		.filter(Boolean);

	return {
		umis,
		users,
		channelStreams,
		directMessageStreams,
		serviceStreams,
		mutedStreams,
		teammates: teamMembers,
		oneOnOnePeople,
		team: teams[context.currentTeamId]
	};
};

export default connect(
	mapStateToProps,
	{
		createStream,
		setUserPreference,
		setCurrentStream
	}
)(SimpleChannelPanel);
