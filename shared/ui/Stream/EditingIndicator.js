import React from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import Icon from "./Icon";

export class SimpleEditingIndicator extends React.Component {
	makeNameList(names, hasConflict) {
		let message = "";

		if (hasConflict) {
			if (names.length == 1) message = "Potential merge conflict with " + names[0];
			else if (names.length == 2)
				message = "Potential merge conflict with " + names[0] + " and " + names[1];
			else if (names.length > 2) {
				let last = names.pop();
				message = "Potential merge conflict with " + names.join(", ") + ", and " + last;
			}
		} else {
			if (names.length == 1) message = names[0] + " is editing this file";
			else if (names.length == 2)
				message = names[0] + " and " + names[1] + " are editing this file";
			else if (names.length > 2) {
				let last = names.pop();
				message = names.join(", ") + ", and " + last + " are editing this file";
			}
		}
		return message;
	}

	render() {
		const { teamMembers, currentUser, editingUsers = {} } = this.props;

		let names = Object.keys(editingUsers)
			.map(userId => {
				return userId !== currentUser.id && editingUsers[userId]
					? teamMembers[userId].username
					: null;
			})
			.filter(Boolean);

		// you can test what it looks like by hard-coding this
		// names = ["larry", "fred"];

		const modifiedByMe = Boolean(editingUsers[currentUser.id]);
		const modifiedByOthers = names.length > 0;
		const hasConflict = modifiedByMe && modifiedByOthers;

		const editingIndicatorClass = createClassString({
			"editing-indicator": true,
			conflict: hasConflict
		});

		if (!modifiedByOthers) return null;

		return (
			<div className={editingIndicatorClass}>
				{hasConflict && <Icon name="alert" />}
				{this.makeNameList(names, hasConflict)}
			</div>
		);
	}
}

const mapStateToProps = ({ capabilities, context, session, teams, users }) => {
	const team = teams[context.currentTeamId];

	const teamMembers = team.memberIds.map(id => users[id]).filter(Boolean);
	// .filter(user => user && user.isRegistered);

	return {
		teamMembers: users,
		currentUser: users[session.userId]
	};
};

export default connect(
	mapStateToProps,
	{}
)(SimpleEditingIndicator);
