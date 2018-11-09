import React, { Component } from "react";
import { FormattedMessage, injectIntl } from "react-intl";
import { connect } from "react-redux";
import _ from "underscore";
import Button from "./Button";
import CancelButton from "./CancelButton";
import createClassString from "classnames";
import { invite } from "./actions";
import { isInVscode, mapFilter } from "../utils";
import VsCodeKeystrokeDispatcher from "../utilities/vscode-keystroke-dispatcher";

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

	componentDidMount() {
		if (isInVscode()) {
			this.disposable = VsCodeKeystrokeDispatcher.on("keydown", event => {
				if (event.key === "Escape") {
					this.goToChannels();
				}
			});
		}
	}

	componentWillUnmount() {
		this.disposable && this.disposable.dispose();
	}

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
		event.preventDefault();
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

	tabIndex = () => {
		return global.atom ? this.tabIndexCount++ : "0";
	};

	renderInviteSlack = () => {
		const { teamId } = this.props;

		return (
			<div style={{ padding: "30px" }}>
				Invite your teammates to give CodeStream a try by sharing this URL with them:
				<br />
				<br />
				<b>
					https://app.codestream.com/invite?service=slack&amp;team=
					{teamId}
				</b>
				<br />
				<br />
			</div>
		);
	};
	// Post URL to{" "}
	// <select style={{ width: "auto" }}>
	// 	<option>#general</option>
	// </select>
	// <Button>Go</Button>

	renderFieldset = inactive => {
		const { newMemberEmail, newMemberName } = this.state;

		if (this.props.isSlackTeam) return this.renderInviteSlack();

		return (
			<fieldset className="form-body" disabled={inactive}>
				<div id="controls">
					<div className="control-group">
						<label>Email</label>
						<input
							className="native-key-bindings input-text"
							id="invite-email-input"
							type="text"
							tabIndex={this.tabIndex()}
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
							tabIndex={this.tabIndex()}
							value={newMemberName}
							onChange={this.onNameChange}
						/>
					</div>
					<div className="button-group">
						<Button
							id="add-button"
							className="control-button"
							tabIndex={this.tabIndex()}
							type="submit"
							loading={this.state.loading}
						>
							<FormattedMessage id="teamMemberSelection.invite" defaultMessage="Invite" />
						</Button>
						<Button
							id="discard-button"
							className="control-button cancel"
							tabIndex={this.tabIndex()}
							type="submit"
							onClick={() => this.props.setActivePanel("channels")}
						>
							Cancel
						</Button>
					</div>
				</div>
			</fieldset>
		);
	};

	goToChannels = () => this.props.setActivePanel("channels");

	render() {
		const inactive = this.props.activePanel !== "invite";

		const panelClass = createClassString({
			panel: true,
			"invite-panel": true
		});

		this.tabIndexCount = 0;

		return (
			<div className={panelClass}>
				<div className="panel-header">
					<CancelButton onClick={this.goToChannels} />
					<span className="panel-title">Invite People</span>
				</div>
				<form className="standard-form vscroll" onSubmit={this.onSubmit}>
					{this.renderFieldset(inactive)}
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
									<div className="committer-name">
										{user.fullName} (@
										{user.username})<span className="committer-email"> {user.email}</span>
									</div>
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
)(injectIntl(InvitePage));
