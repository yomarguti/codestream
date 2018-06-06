import React, { Component } from "react";
import { connect } from "react-redux";
import Menu from "./Menu";
import * as contextActions from "../actions/context";
import * as userActions from "../actions/user";
import * as streamActions from "../actions/stream";

export class SimpleChannelMenu extends Component {
	constructor(props) {
		super(props);
		this.state = {};
	}

	render() {
		const { stream, target, umiCount, isMuted } = this.props;

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
			{ label: muteLabel + streamName, action: "mute-channel" },
			{ label: "Leave " + streamName, action: "leave-channel", disabled: cantLeave },
			{ label: "-" },
			{ label: "Connect to Slack", action: "connect-slack" },
			{ label: "Connect to MS Teams", action: "connect-ms-teams" }
		];

		return <Menu items={items} target={target} action={this.menuAction} />;
	}

	menuAction = action => {
		const streamId = this.props.stream.id;

		if (action === "view-members") {
			this.props.setActivePanel("main");
			this.props.setCurrentStream(streamId);
			setTimeout(() => {
				this.props.postSystemMessage("view-members");
			}, 500);
		} else if (action === "mute-channel") {
			console.log("MUTING CHANNEL: ", this.props.isMuted);
			this.props.setUserPreference(["mutedStreams", streamId], !this.props.isMuted);
		} else if (action === "add-members") {
			this.props.setActivePanel("main");
			this.props.setCurrentStream(streamId);
			setTimeout(() => {
				this.props.postSystemMessage("add-members-instructions");
			}, 500);
		} else if (action === "rename-channel") {
			this.props.setActivePanel("main");
			this.props.setCurrentStream(streamId);
			setTimeout(() => {
				this.props.postSystemMessage("rename-channel-instructions");
			}, 500);
		} else if (action === "leave-channel") {
			atom.confirm(
				{
					message: "Are you sure you want to leave this channel?",
					buttons: ["Leave Channel", "Cancel"]
				},
				response => {
					if (response === 0) {
						console.log("leaving!: ", streamId);
						this.props.removeUserFromStream(streamId, this.props.session.userId);
					} else {
						console.log("stay");
					}
				}
			);
		}
		this.props.closeMenu();
		// this.setState({ openMenu: null });
	};
}

const mapStateToProps = ({ users, session }) => ({ session });
export default connect(
	mapStateToProps,
	{
		...contextActions,
		...streamActions,
		...userActions
	}
)(SimpleChannelMenu);
