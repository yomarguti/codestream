import React, { Component } from "react";
import { FormattedMessage, injectIntl } from "react-intl";
import { connect } from "react-redux";
import _ from "underscore";
import Icon from "./Icon";
import Button from "./Button";
import Tooltip from "./Tooltip";
import { invite } from "./actions";
import { mapFilter } from "../utils";

export class PeoplePage extends Component {
	initialState = {};

	state = this.initialState;

	render() {
		return (
			<div className="panel people-panel">
				<form className="standard-form vscroll" onSubmit={this.onSubmit}>
					{this.props.invited.length > 0 && (
						<div className="section">
							<div className="header">
								<span>Outstanding Invitations</span>
							</div>
							<ul>
								{this.props.invited.map(user => (
									<li key={user.email}>
										<div className="committer-email">
											{user.email}
											<a
												className="reinvite"
												onClick={event => {
													event.preventDefault();
													this.onClickReinvite(user);
												}}
											>
												reinvite
											</a>
										</div>
									</li>
								))}
							</ul>
						</div>
					)}
					<div className="section">
						<div className="header">
							<span>Current Team</span>
						</div>
						<ul>
							{this.props.members.map(user => (
								<li key={user.email}>
									<div className="committer-name">{user.fullName}</div>
									<div className="committer-email">{user.email}</div>
								</li>
							))}
						</ul>
					</div>
				</form>
			</div>
		);
	}
}

const mapStateToProps = ({ users, context, teams }) => {
	const team = teams[context.currentTeamId];
	const members = mapFilter(team.memberIds, id => {
		const user = users[id];
		if (!user || !user.isRegistered || user.deactivated) return;
		if (!user.fullName) {
			let email = user.email;
			if (email) user.fullName = email.replace(/@.*/, "");
		}
		return user;
	});
	const invited = mapFilter(team.memberIds, id => {
		const user = users[id];
		if (!user || user.isRegistered || user.deactivated) return;
		let email = user.email;
		if (email) user.fullName = email.replace(/@.*/, "");
		return user;
	});

	return {
		teamId: team.id,
		teamName: team.name,
		members: _.sortBy(members, "name"),
		invited: _.sortBy(invited, "email")
	};
};

export default connect(
	mapStateToProps,
	{
		invite
	}
)(injectIntl(PeoplePage));
