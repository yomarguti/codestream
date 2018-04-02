import React, { Component } from "react";
import { FormattedMessage, injectIntl } from "react-intl";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import _ from "underscore-plus";
import Button from "./Onboarding/Button";
import Tooltip from "./Tooltip";
import UnexpectedErrorMessage from "./Onboarding/UnexpectedErrorMessage";
import { exitInvitePage } from "../actions/routing";
import * as teamActions from "../actions/team";

const EMAIL_REGEX = new RegExp(
	"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
);

export class InvitePage extends Component {
	static contextTypes = {
		repositories: PropTypes.array
	};

	initialState = {
		newMemberEmail: "",
		newMemberInvalid: false,
		newMemberInputTouched: false
	};

	state = this.initialState;

	// async componentDidMount() {
	// 	const repository = this.context.repositories[0];
	// 	const cwd = repository.getWorkingDirectory();
	// 	const logFormat = "--format=%an<trim-this>%ae";
	// 	const cutoffDate = "6 months ago";
	// 	const recentCommitterData = await git(["log", logFormat, `--since="${cutoffDate}"`], { cwd });
	// 	const recentCommitters = parseCommitters(recentCommitterData.split("\n"), { selected: false });
	// 	const olderCommitterData = await git(["log", logFormat, `--before="${cutoffDate}"`], { cwd });
	// 	const olderCommitters = parseCommitters(olderCommitterData.split("\n"), {
	// 		selected: false
	// 	}).filter(committer => !_.findWhere(recentCommitters, { email: committer.email }));
	//
	// 	const committers = [...recentCommitters, ...olderCommitters].filter(
	// 		c => !this.props.memberEmails.includes(c.email)
	// 	);
	//
	// 	if (committers.length === 0) return this.props.completeOnboarding();
	//
	// 	this.setState({
	// 		loadingCommitters: false,
	// 		committers
	// 	});
	// }

	// renderSubmissionOfNewMembersError = () => {
	// 	if (this.props.errors.teamNotFound)
	// 		return (
	// 			<p className="error-message">
	// 				<FormattedMessage id="teamSelection.error.teamNotFound" />
	// 			</p>
	// 		);
	// 	if (this.props.errors.noPermission)
	// 		return (
	// 			<p className="error-message">
	// 				<FormattedMessage id="teamSelection.error.noPermission" />
	// 			</p>
	// 		);
	// 	if (this.props.errors.unknown) return <UnexpectedErrorMessage classes="error-message" />;
	// };

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
				<h2>{`Invite to ${this.props.teamName}`}</h2>
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
							<Tooltip title="Team member's email address" placement="left" delay="0">
								<input
									className="native-key-bindings input-text"
									type="text"
									placeholder="Enter email address"
									value={newMemberEmail}
									onChange={this.onNewMemberChange}
									onBlur={this.onNewMemberBlur}
									autoFocus
								/>
							</Tooltip>
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
				<Button onClick={this.props.goBack}>DONE</Button>
			</div>
		);
	}
}

const mapStateToProps = ({ session, users, context, teams }) => {
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
