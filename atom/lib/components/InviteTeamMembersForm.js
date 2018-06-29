import React, { Component } from "react";
import { FormattedMessage, injectIntl } from "react-intl";
import { connect } from "react-redux";
import _ from "underscore-plus";
import Button from "./onboarding/Button";
import Tooltip from "./Tooltip";
import { exitInvitePage } from "../actions/routing";
import * as teamActions from "../actions/team";

const EMAIL_REGEX = new RegExp(
	"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
);

export class InvitePage extends Component {
	initialState = {
		newMemberEmail: "",
		newMemberInvalid: false,
		newMemberInputTouched: false
	};

	state = this.initialState;

	onNewMemberChange = event => this.setState({ newMemberEmail: event.target.value });

	onNewMemberBlur = event => {
		this.setState(state => ({
			inputTouched: true,
			newMemberEmailInvalid:
				state.newMemberEmail !== "" && EMAIL_REGEX.test(state.newMemberEmail) === false
		}));
	};

	onSubmit = event => {
		const { newMemberEmail, newMemberEmailInvalid } = this.state;
		if (newMemberEmailInvalid || newMemberEmail === "") return;

		this.props.invite({ email: newMemberEmail, teamId: this.props.teamId });

		this.setState(this.initialState);
	};

	onClickReinvite = user => {
		this.props.invite({ email: user.email, teamId: this.props.teamId }).then(() => {
			atom.notifications.addInfo(
				this.props.intl.formatMessage({
					id: "invitation.emailSent",
					defaultMessage: `Invitation sent to ${user.email}!`
				})
			);
		});
	};

	render() {
		const { newMemberEmail, newMemberEmailInvalid, inputTouched } = this.state;
		return (
			<div id="invite-team-members">
				<Button onClick={this.props.goBack}>Back to stream</Button>
				<br />
				<h2>{this.props.teamName}</h2>
				<form onSubmit={this.onSubmit}>
					<div className="errors">
						{inputTouched &&
							newMemberEmailInvalid && (
								<span className="error-message">
									<FormattedMessage id="signUp.email.invalid" />
								</span>
							)}
					</div>
					<div className="add-member-form">
						<div>
							<input
								className="native-key-bindings input-text"
								type="text"
								placeholder="Enter email address"
								value={newMemberEmail}
								onChange={this.onNewMemberChange}
								onBlur={this.onNewMemberBlur}
								autoFocus
							/>
						</div>
						<Button>
							<FormattedMessage id="teamMemberSelection.add" defaultMessage="INVITE" />
						</Button>
					</div>
				</form>
				<ul>
					{this.props.members.map(user => (
						<li key={user.email}>
							<div className="block">
								<div className="committer-info">
									<div className="committer-name">{user.name}</div>
									<div className="committer-email">
										<Tooltip title={user.email} placement="left" delay={{ show: 1000 }}>
											<div className="split">{user.email}</div>
										</Tooltip>
										{!user.isRegistered && (
											<div className="split">
												<a className="reinvite" onClick={() => this.onClickReinvite(user)}>
													reinvite
												</a>
											</div>
										)}
									</div>
								</div>
							</div>
						</li>
					))}
				</ul>
			</div>
		);
	}
}

const mapStateToProps = ({ users, context, teams }) => {
	const team = teams[context.currentTeamId];
	const members = team.memberIds
		.map(id => {
			const user = users[id];
			if (user && user.isRegistered) user.name = `${user.firstName} ${user.lastName}`.trim();
			return user;
		})
		.filter(Boolean);

	return {
		teamId: team.id,
		teamName: team.name,
		members: _.sortBy(members, "email")
	};
};
export default connect(mapStateToProps, { goBack: exitInvitePage, ...teamActions })(
	injectIntl(InvitePage)
);
