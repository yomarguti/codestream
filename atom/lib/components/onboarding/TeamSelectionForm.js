import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import Button from "./Button";
import UnexpectedErrorMessage from "./UnexpectedErrorMessage";
import * as actions from "../../actions/onboarding";

export class SimpleTeamSelectionForm extends Component {
	constructor(props) {
		super(props);
		this.state = {
			selectedValue: "",
			newTeamName: "",
			touched: false,
			selectionRequired: false
		};
	}

	isSelected = value => this.state.selectedValue === value;

	onSelect = event => {
		const { value } = event.target;
		this.setState({ selectedValue: value });
		if (value === "createTeam") this.nameInput.focus();
	};

	onChange = event =>
		this.setState({ selectedValue: "createTeam", newTeamName: event.target.value });

	onBlur = e => this.setState({ touched: true });

	onSubmit = () => {
		this.setState(
			state => {
				const { selectedValue, newTeamName } = state;
				const noSelection = selectedValue === "";
				const noTeamName = selectedValue === "createTeam" && newTeamName === "";
				return {
					touched: true,
					selectionRequired: noSelection || noTeamName
				};
			},
			() => {
				if (this.state.selectionRequired) return;
				const { selectedValue, newTeamName } = this.state;

				if (selectedValue === "createTeam") this.props.createTeam(newTeamName);
				else this.props.addRepoForTeam(selectedValue);
			}
		);
	};

	renderError = () => {
		if (this.props.errors.teamNotFound)
			return (
				<p className="error-message">
					<FormattedMessage id="teamSelection.error.teamNotFound" />
				</p>
			);
		if (this.props.errors.noPermission)
			return (
				<p className="error-message">
					<FormattedMessage id="teamSelection.error.noPermission" />
				</p>
			);
		if (this.props.errors.unknown) return <UnexpectedErrorMessage classes="error-message" />;
		if (this.state.touched && this.state.selectionRequired)
			return (
				<p className="error-message">
					<FormattedMessage
						id="teamSelection.error.noSelection"
						defaultMessage="Please create or select a team."
					/>
				</p>
			);
	};

	render() {
		let goBack = "";
		if (this.props.showBackButton) {
			goBack = (
				<div className="footer">
					<br />
					<p>
						<a onClick={this.props.backToInvite}>
							<FormattedMessage id="teamSelection.backToInvite" defaultMessage="Go Back" />
						</a>
					</p>
				</div>
			);
		}
		return (
			<div id="team-selection">
				<h2>
					<FormattedMessage id="teamSelection.header" defaultMessage=" Select Team" />
				</h2>
				<p>
					<FormattedMessage
						id="teamSelection.whichTeam"
						defaultMessage="Which team owns this repo?"
					/>
				</p>
				<form onBlur={this.onBlur} onSubmit={this.onSubmit}>
					{this.renderError()}
					<div className="control-group">
						<label className="input-label">
							<input
								className="input-radio"
								type="radio"
								name="team"
								value="createTeam"
								checked={this.isSelected("createTeam")}
								onChange={this.onSelect}
							/>
							<FormattedMessage id="teamSelection.createTeam" defaultMessage="Create a new team" />
						</label>
						<input
							id="name-input"
							type="text"
							className="native-key-bindings input-text"
							placeholder="Team Name"
							value={this.state.newTeamName}
							onChange={this.onChange}
							ref={element => (this.nameInput = element)}
						/>
					</div>
					{this.props.teams.map((team, index) => {
						return (
							<div key={index} className="control-group">
								<label className="input-label">
									<input
										className="input-radio"
										type="radio"
										name="team"
										value={team.id}
										checked={this.isSelected(team.id)}
										onChange={this.onSelect}
									/>
									{team.name}
								</label>
							</div>
						);
					})}
					<Button id="submit-button" loading={this.props.loading} onClick={this.onSubmit}>
						<FormattedMessage id="teamSelection.submitButton" defaultMessage="NEXT" />
					</Button>
				</form>
				{goBack}
			</div>
		);
	}
}

const mapStateToProps = ({ onboarding, session, teams, users }) => {
	const currentUser = users[session.userId];
	return {
		showBackButton: onboarding.fromInvite,
		teams: currentUser.teamIds.map(id => teams[id]),
		loading: onboarding.requestInProcess,
		errors: onboarding.errors
	};
};
export default connect(mapStateToProps, actions)(SimpleTeamSelectionForm);
