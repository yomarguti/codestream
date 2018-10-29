import React, { Component } from "react";
import { connect } from "react-redux";
import Menu from "./Menu";
import * as contextActions from "../actions/context";
// import * as userActions from "../actions/user";
import * as streamActions from "./actions";

export class SimpleChannelMenu extends Component {
	constructor(props) {
		super(props);
		this.state = {};
	}

	render() {
		const { canMute, stream, target, umiCount, isMuted } = this.props;

		const streamName = stream.privacy === "private" ? stream.name : "#" + stream.name;
		let cantLeave = false,
			cantAdd = false,
			upToDate = false;
		if (stream.isTeamStream) cantLeave = "Unavailable in all-hands channels";
		if (stream.isTeamStream) cantAdd = "Unavailable in all-hands channels";
		const muteLabel = isMuted ? "Unmute " : "Mute ";
		if (umiCount === 0) upToDate = "You are up-to-date";
		let items = [
			{ label: "View Members", action: "view-members" },
			{ label: "Add Members to " + streamName, action: "add-members", disabled: cantAdd },
			{ label: "Rename Channel", action: "rename-channel" },
			{ label: "-" },
			{ label: "Mark Read", action: "mark-read", disabled: upToDate },
			{ label: "-" },
			canMute ? { label: muteLabel + streamName, action: "mute-channel" } : false,
			{ label: "Leave " + streamName, action: "leave-channel", disabled: cantLeave }
			// { label: "-" },
			// { label: "Connect to Slack", action: "connect-slack" },
			// { label: "Connect to MS Teams", action: "connect-ms-teams" }
		].filter(Boolean);

		return <Menu items={items} target={target} action={this.menuAction} />;
	}

	menuAction = action => {
		const streamId = this.props.stream.id;

		this.props.closeMenu();

		switch (action) {
			case "view-members":
				this.props.setActivePanel("main");
				this.props.setCurrentStream(streamId);
				setTimeout(() => {
					this.props.runSlashCommand("who");
				}, 500);
				return;
			case "mute-channel":
				this.props.changeStreamMuteState(streamId, !this.props.isMuted);
				return;
			case "add-members":
				this.props.setActivePanel("main");
				this.props.setCurrentStream(streamId);
				setTimeout(() => {
					this.props.runSlashCommand("add");
				}, 500);
				return;
			case "rename-channel":
				this.props.setActivePanel("main");
				this.props.setCurrentStream(streamId);
				setTimeout(() => {
					this.props.runSlashCommand("rename");
				}, 500);
				return;
			case "leave-channel":
				this.props.setActivePanel("main");
				this.props.setCurrentStream(streamId);
				setTimeout(() => {
					this.props.runSlashCommand("leave");
				}, 100);
				return;
			case "mark-read":
				this.props.markStreamRead(streamId);
				return;
		}
	};
}

const mapStateToProps = ({ capabilities, session }) => ({ canMute: capabilities.mute, session });
export default connect(
	mapStateToProps,
	{
		...contextActions,
		...streamActions
		// ...userActions
	}
)(SimpleChannelMenu);
