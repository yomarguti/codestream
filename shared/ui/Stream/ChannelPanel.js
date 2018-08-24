import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import _ from "underscore";
import { createStream, setCurrentStream, setUserPreference } from "./actions";
import {
	getChannelStreamsForTeam,
	getDirectMessageStreamsForTeam,
	getServiceStreamsForTeam
} from "../reducers/streams";
import Icon from "./Icon";
import ChannelMenu from "./ChannelMenu";

export class SimpleChannelPanel extends Component {
	constructor(props) {
		super(props);

		this.state = {};
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
			<div>
				<div className={channelPanelClass} ref={this._channelPanel}>
					<div className="panel-header">
						<span className="panel-title">{teamName}</span>
					</div>
					<div className="channel-list vscroll">
						{this.renderTeamChannels()}
						{this.renderDirectMessages()}
						{this.renderServiceChannels()}
					</div>
				</div>
			</div>
		);
	}

	renderTeamChannels = () => {
		return (
			<div className="section">
				<div className="header" onClick={this.handleClickShowPublicChannels}>
					<span className="clickable">Team Channels</span>
					<Icon className="align-right" name="plus" onClick={this.handleClickCreateChannel} />
				</div>
				{this.renderStreams(this.props.channelStreams)}
			</div>
		);
	};

	renderServiceChannels = () => {
		return (
			<div className="section">
				<div className="header" onClick={this.handleClickShowPublicChannels}>
					<span className="clickable">Live Share Sessions</span>
					<Icon className="align-right" name="plus" onClick={this.handleClickCreateChannel} />
				</div>
				{this.renderStreams(this.props.serviceStreams)}
			</div>
		);
	};

	renderStreams = streams => {
		return (
			<ul onClick={this.handleClickSelectStream}>
				{streams.map(stream => {
					if (stream.isArchived) return null;
					if (stream.name.match(/^ls:/)) return null;
					const icon = this.props.mutedStreams[stream.id] ? (
						<Icon className="mute" name="mute" />
					) : stream.privacy === "private" ? (
						<Icon className="lock" name="lock" />
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
								<Icon
									name="gear"
									className="align-right"
									onClick={this.handleClickStreamSettings}
								/>
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
				})}
			</ul>
		);
	};

	renderDirectMessages = () => {
		return (
			<div className="section">
				<div className="header clickable" onClick={this.handleClickCreateDirectMessage}>
					<span className="clickable">Direct Messages</span>
					<Icon name="plus" className="align-right" />
				</div>
				<ul onClick={this.handleClickSelectStream}>
					{this.props.directMessageStreams.map(stream => {
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
						return (
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
								<Icon name="x" onClick={this.handleClickMuteStream} className="align-right" />
							</li>
						);
					})}
					{this.props.teammates.map(teammate => {
						if (_.contains(this.props.oneOnOnePeople, teammate.id)) return null;
						if (this.props.mutedStreams[teammate.id]) return null;
						return (
							<li key={teammate.id} teammate={teammate.id}>
								<Icon className="person" name="person" />
								<span className="name">{teammate.username || teammate.fullName}</span>
								<Icon name="x" onClick={this.handleClickMuteStream} className="align-right" />
							</li>
						);
					})}
					<li className="invite" onClick={() => this.props.setActivePanel("invite")}>
						<span>
							<Icon name="plus-small" />
							Invite People
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

	handleClickCreateChannel = event => {
		this.props.setActivePanel("create-channel");
		event.stopPropagation();
	};

	handleClickShowPublicChannels = event => {
		this.props.setActivePanel("public-channels");
	};

	handleClickCreateDirectMessage = event => {
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

	const directMessageStreams = _.sortBy(
		getDirectMessageStreamsForTeam(streams, context.currentTeamId, session.userId, users) || [],
		stream => (stream.name || "").toLowerCase()
	);

	const serviceStreams = _.sortBy(
		getServiceStreamsForTeam(streams, context.currentTeamId, session.userId, users) || [],
		stream => (stream.name || "").toLowerCase()
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
