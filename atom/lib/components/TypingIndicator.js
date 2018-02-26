import React from "react";
import _ from "underscore-plus";
import createClassString from "classnames";

export default class TypingIndicator extends React.Component {
	makeNameList(names, hasConflict) {
		let message = "";

		if (hasConflict) {
			if (names.length == 1) message = "Pending merge conflict with " + names[0];
			else if (names.length == 2)
				message = "Pending merge conflict with " + names[0] + " and " + names[1];
			else if (names.length > 2) {
				let last = names.pop();
				message = "Pending merge conflict with " + names.join(", ") + ", and " + last;
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
		const users = this.props.users || [];
		const editingUsers = this.props.editingUsers || {};

		let names = Object.keys(_.compactObject(editingUsers)).map(userId => {
			return editingUsers[userId] ? users[userId].username : null;
		});

		const modifiedByMe = this.props.modifiedGit || this.props.modifiedTyping;
		const modifiedByOthers = names.length > 0;
		const hasConflict = modifiedByMe && modifiedByOthers;

		const typingIndicatorClass = createClassString({
			"typing-indicator": true,
			conflict: hasConflict,
			inactive: this.props.inactive || !modifiedByOthers
		});

		return (
			<div className={typingIndicatorClass}>
				<div>{this.makeNameList(names, hasConflict)}</div>
			</div>
		);
	}
}
