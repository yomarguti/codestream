import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import _ from "underscore";
// import * as contextActions from "../actions/context";
import * as routingActions from "../actions/routing";
import { createStream, setCurrentStream, setUserPreference } from "./actions";
import { getChannelStreamsForTeam, getDirectMessageStreamsForTeam } from "../reducers/streams";
import Menu from "./Menu";
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
						<span>{teamName}</span>
					</div>
					<div className="channel-list postslist">
						{this.renderChannels()}
						{this.renderDirectMessages()}
					</div>
				</div>
			</div>
		);
	}

	renderChannels = () => {
		return (
			<div className="section">
				<div className="header" onClick={this.handleClickShowPublicChannels}>
					Team Channels
					<span
						className="icon icon-diff-added align-right"
						onClick={this.handleClickCreateChannel}
					/>
				</div>
				<ul onClick={this.handleClickSelectStream}>
					{this.props.channelStreams.map(stream => {
						const icon = this.props.mutedStreams[stream.id] ? (
							<span className="icon icon-mute" />
						) : stream.privacy === "private" ? (
							<span className="icon icon-lock" />
						) : (
							<span className="icon">#</span>
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
								<span
									onClick={this.handleClickStreamSettings}
									className="icon icon-gear align-right"
								>
									{menuActive && (
										<ChannelMenu
											stream={stream}
											target={this.state.menuTarget}
											umiCount={count}
											isMuted={this.props.mutedStreams[stream.id]}
											setActivePanel={this.props.setActivePanel}
											postSystemMessage={this.props.postSystemMessage}
											closeMenu={this.closeMenu}
										/>
									)}
								</span>
							</li>
						);
					})}
				</ul>
			</div>
		);
	};

	renderDirectMessages = () => {
		return (
			<div className="section">
				<div className="header" onClick={this.handleClickCreateDirectMessage}>
					Direct Messages<span className="icon icon-diff-added align-right" />
				</div>
				<ul onClick={this.handleClickSelectStream}>
					{this.props.directMessageStreams.map(stream => {
						let count = this.props.umis.unread[stream.id] || 0;
						let mentions = this.props.umis.mentions[stream.id] || 0;
						if (this.props.mutedStreams[stream.id] && !count) return null;
						return (
							<li
								className={createClassString({
									direct: true,
									unread: count > 0
								})}
								key={stream.id}
								id={stream.id}
							>
								<span className="presence" />
								{stream.name}
								{mentions > 0 ? <span className="umi">{mentions}</span> : null}
								<span
									onClick={this.handleClickMuteStream}
									className="icon icon-diff-removed align-right"
								/>
							</li>
						);
					})}
					{this.props.teammates.map(teammate => {
						if (_.contains(this.props.oneOnOnePeople, teammate.id)) return null;
						if (this.props.mutedStreams[teammate.id]) return null;
						return (
							<li key={teammate.id} teammate={teammate.id}>
								<span className="presence" />
								<span className="name">
									{teammate.name || teammate.firstName
										? teammate.firstName + " " + teammate.lastName
										: teammate.username}
								</span>
								<span
									onClick={this.handleClickMuteStream}
									className="icon icon-diff-removed align-right"
								/>
							</li>
						);
					})}
					<li className="invite" onClick={this.props.goToInvitePage}>
						<span className="icon icon-plus-small">Invite People</span>
					</li>
				</ul>
			</div>
		);
	};

	handleClickSelectStream = event => {
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

	// get a list of the users i have 1:1 streams with
	const oneOnOnePeople = directMessageStreams
		.map(stream => {
			const notMe = _.without(stream.memberIds || [], session.userId);
			if (notMe.length === 1) return notMe[0];
			return;
		})
		.filter(Boolean);

	return {
		umis,
		users,
		session,
		channelStreams,
		directMessageStreams,
		mutedStreams,
		teammates: teamMembers,
		oneOnOnePeople,
		team: teams[context.currentTeamId]
	};
};

export default connect(
	mapStateToProps,
	{
		// ...contextActions,
		createStream,
		setUserPreference,
		setCurrentStream,
		goToInvitePage: routingActions.goToInvitePage
	}
)(SimpleChannelPanel);
