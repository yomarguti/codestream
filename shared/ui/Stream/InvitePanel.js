import React, { Component } from "react";
import { FormattedMessage, injectIntl } from "react-intl";
import { connect } from "react-redux";
import _ from "underscore";
import Icon from "./Icon";
import Button from "./Button";
import Tooltip from "./Tooltip";
import createClassString from "classnames";
// import { exitInvitePage } from "../actions/routing";
import { invite } from "./actions";

const EMAIL_REGEX = new RegExp(
	"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
);

export class InvitePage extends Component {
	initialState = {
		loading: false,
		newMemberEmail: "",
		newMemberName: "",
		newMemberInvalid: false,
		newMemberInputTouched: false
	};

	state = this.initialState;

	onEmailChange = event => this.setState({ newMemberEmail: event.target.value });

	onEmailBlur = event => {
		this.setState(state => ({
			inputTouched: true,
			newMemberEmailInvalid:
				state.newMemberEmail !== "" && EMAIL_REGEX.test(state.newMemberEmail) === false
		}));
	};

	onNameChange = event => this.setState({ newMemberName: event.target.value });

	onSubmit = event => {
		const { newMemberEmail, newMemberName, newMemberEmailInvalid } = this.state;
		if (newMemberEmailInvalid || newMemberEmail === "") return;

		this.setState({ loading: true });
		this.props
			.invite({ email: newMemberEmail, fullName: newMemberName, teamId: this.props.teamId })
			.then(() => {
				this.setState(this.initialState);
			});
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

	componentDidUpdate(prevProps, prevState) {
		if (this.props.activePanel === "invite" && prevProps.activePanel !== "invite") {
			setTimeout(() => {
				this.focusEmailInput();
			}, 500);
		}
	}

	focusEmailInput = () => {
		const input = document.getElementById("invite-email-input");
		if (input) input.focus();
	};

	renderEmailHelp = () => {
		const { newMemberEmailInvalid, inputTouched } = this.state;

		if (inputTouched && newMemberEmailInvalid) {
			return (
				<small className="error-message">
					<FormattedMessage id="signUp.email.invalid" />
				</small>
			);
		} else return null;
	};

	render() {
		const { newMemberEmail, newMemberName } = this.state;
		const inactive = this.props.activePanel !== "invite";
		const shrink = this.props.activePanel === "main";

		const panelClass = createClassString({
			panel: true,
			"invite-panel": true,
			shrink,
			"off-right": inactive && !shrink
		});

		return (
			<div className={panelClass}>
				<div className="panel-header">
					<span className="align-left-button" onClick={() => this.props.setActivePanel("channels")}>
						<Icon name="chevron-left" className="show-channels-icon" />
					</span>
					<span className="panel-title">Invite People</span>
				</div>
				<form className="standard-form vscroll" onSubmit={this.onSubmit}>
					<fieldset className="form-body" disabled={inactive}>
						<div id="controls">
							<div className="control-group">
								<label>Email</label>
								<input
									className="native-key-bindings input-text"
									id="invite-email-input"
									type="text"
									tabIndex="0"
									value={newMemberEmail}
									onChange={this.onEmailChange}
									onBlur={this.onEmailBlur}
									autoFocus
								/>
								{this.renderEmailHelp()}
							</div>
							<div className="control-group">
								<label>
									Name <span className="optional">(optional)</span>
								</label>
								<input
									className="native-key-bindings input-text"
									type="text"
									tabIndex="1"
									value={newMemberName}
									onChange={this.onNameChange}
								/>
							</div>
							<div className="button-group">
								<Button
									id="add-button"
									className="control-button"
									tabIndex="2"
									type="submit"
									loading={this.state.loading}
								>
									<FormattedMessage id="teamMemberSelection.invite" defaultMessage="Invite" />
								</Button>
								<Button
									id="discard-button"
									className="control-button cancel"
									tabIndex="3"
									type="submit"
									onClick={() => this.props.setActivePanel("channels")}
								>
									Cancel
								</Button>
							</div>
						</div>
					</fieldset>
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
											<a className="reinvite" onClick={() => this.onClickReinvite(user)}>
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
	const members = team.memberIds
		.map(id => {
			const user = users[id];
			if (!user || !user.isRegistered) return;
			if (!user.fullName) {
				let email = user.email;
				if (email) user.fullName = email.replace(/@.*/, "");
			}
			return user;
		})
		.filter(Boolean);
	const invited = team.memberIds
		.map(id => {
			const user = users[id];
			if (!user || user.isRegistered) return;
			let email = user.email;
			if (email) user.fullName = email.replace(/@.*/, "");
			return user;
		})
		.filter(Boolean);

	return {
		teamId: team.id,
		teamName: team.name,
		members: _.sortBy(members, "name"),
		invited: _.sortBy(invited, "email")
	};
};

export default connect(mapStateToProps, {
	invite
})(injectIntl(InvitePage));
