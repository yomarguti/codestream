import React, { Component } from "react";
import { connect } from "react-redux";
import * as contextActions from "../actions/context";
import * as streamActions from "./actions";
import createClassString from "classnames";
import {
	getChannelStreamsForTeam,
	getPublicChannelStreamsForTeam,
	getArchivedChannelStreamsForTeam
} from "../reducers/streams";
import Icon from "./Icon";
import Button from "./Button";
import { FormattedMessage } from "react-intl";
import * as routingActions from "../actions/routing";
import _ from "underscore";
import Timestamp from "./Timestamp";

export class SimplePublicChannelPanel extends Component {
	constructor(props) {
		super(props);

		this.state = { loading: null };
	}

	render() {
		const inactive = this.props.activePanel !== "public-channels";
		const shrink = this.props.activePanel === "main";

		const panelClass = createClassString({
			panel: true,
			"public-channel-panel": true,
			shrink,
			"off-right": inactive && !shrink
		});

		return (
			<div className={panelClass}>
				<div className="panel-header">
					<span onClick={this.showChannels} className="align-left-button">
						<Icon name="chevron-left" className="show-channels-icon" />
					</span>
					<span className="panel-title">All Channels</span>
					<span onClick={this.handleClickCreateChannel} className="align-right-button">
						<Icon name="plus" />
					</span>
				</div>
				<div className="channel-list postslist">
					<p className="explainer">
						Channels are where your dev team discusses projects, repos, or code in general. You
						might create one channel per repo, or one per client.
					</p>
					<div className="section">
						<div className="header">Channels you can join</div>
						<ul onClick={this.handleClickJoinStream}>
							{this.renderChannels(this.props.publicStreams)}
						</ul>
					</div>
					<div className="section">
						<div className="header">Channels you are in</div>
						<ul onClick={this.handleClickSelectStream}>
							{this.renderChannels(this.props.channelStreams)}
						</ul>
					</div>
					<div className="section">
						<div className="header">Archived Channels</div>
						<ul onClick={this.handleClickUnArchive}>
							{this.renderChannels(this.props.archivedStreams)}
						</ul>
					</div>
				</div>
			</div>
		);
	}

	renderChannels = streams => {
		if (streams.length === 0) {
			return <div className="no-matches">No channels match this type</div>;
		}
		return [
			streams.map(stream => {
				if (stream.name.match(/^ls:/)) return null;
				const icon =
					stream.id && stream.id === this.state.loading ? (
						<span className="loading loading-spinner-tiny inline-block" />
					) : stream.privacy === "private" ? (
						<Icon className="lock" name="lock" />
					) : (
						<span className="icon hash">#</span>
					);
				// const icon =
				// 	stream.privacy === "private" ? (
				// 		<span className="icon icon-lock" />
				// 	) : (
				// 		<span className="icon">#</span>
				// 	);
				return (
					<li key={stream.id} id={stream.id}>
						{icon}
						{stream.name}
						<Timestamp time={stream.mostRecentPostCreatedAt} />
						<div className="explainer">{stream.purpose}</div>
					</li>
				);
			})
		];
	};

	handleClickSelectStream = event => {
		var liDiv = event.target.closest("li");
		if (!liDiv || !liDiv.id) return; // FIXME throw error
		this.props.setActivePanel("main");
		this.props.setCurrentStream(liDiv.id);
	};

	handleClickJoinStream = async event => {
		var liDiv = event.target.closest("li");
		if (!liDiv || !liDiv.id) return; // FIXME throw error
		this.setState({ loading: liDiv.id });
		await this.props.joinStream(liDiv.id);
		this.setState({ loading: null });
		this.props.setActivePanel("main");
		this.props.setCurrentStream(liDiv.id);
	};

	showChannels = event => {
		this.props.setActivePanel("channels");
	};

	handleClickCreateChannel = event => {
		this.props.setActivePanel("create-channel");
		event.stopPropagation();
	};
}

const mapStateToProps = ({ context, streams, users, teams, umis, session }) => {
	const teamMembers = teams[context.currentTeamId].memberIds.map(id => users[id]).filter(Boolean);

	const channelStreams = _.sortBy(
		getChannelStreamsForTeam(streams, context.currentTeamId, session.userId) || [],
		stream => stream.name.toLowerCase()
	);

	const publicStreams = _.sortBy(
		getPublicChannelStreamsForTeam(streams, context.currentTeamId, session.userId) || [],
		stream => stream.name.toLowerCase()
	);

	const archivedStreams = _.sortBy(
		getArchivedChannelStreamsForTeam(streams, context.currentTeamId, session.userId) || [],
		stream => stream.name.toLowerCase()
	);

	return {
		umis,
		session,
		channelStreams,
		publicStreams,
		archivedStreams,
		teammates: teamMembers,
		team: teams[context.currentTeamId]
	};
};

export default connect(mapStateToProps, {
	...contextActions,
	...streamActions
})(SimplePublicChannelPanel);
