import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import withAPI from "./withAPI";
import Button from "./Button";
import { createTeam } from "../actions/team";

export class SimpleTeamSelectionForm extends Component {
	constructor(props) {
		super(props);
		this.state = {
			selectedValue: "",
			newTeamName: "",
			loading: false,
			teamNotFound: false,
			teams: props.store.getState().teams
		};
	}

	isSelected = value => this.state.selectedValue === value;

	isFormInvalid = () => {
		const { selectedValue, newTeamName } = this.state;
		const noSelection = selectedValue === "";
		const noTeamName = selectedValue === "createTeam" && newTeamName === "";
		return noSelection || noTeamName;
	};

	onSelect = event => {
		const { value } = event.target;
		this.setState({ selectedValue: value });
		if (value === "createTeam") this.nameInput.focus();
	};

	onChange = event =>
		this.setState({ selectedValue: "createTeam", newTeamName: event.target.value });

	onSubmit = () => {
		if (this.isFormInvalid()) return;
		this.setState({ loading: true });
		const { createTeam, store, transition } = this.props;
		const { url, firstCommitHash } = store.getState().repoMetadata;
		const { selectedValue, newTeamName, teams } = this.state;
		const name = selectedValue === "createTeam" ? newTeamName : selectedValue;

		let promise;
		if (selectedValue === "createTeam") {
			promise = createTeam({ name: newTeamName, url, firstCommitHash });
		} else {
			promise = createTeam({ teamId: selectedValue, url, firstCommitHash });
		}
		promise
			.then(data => {
				this.setState({ loading: false });
				transition("success");
			})
			.catch(error => {
				this.setState({ loading: false });
				if (error.data.code === "RAPI-1003") {
					this.setState({ teamNotFound: true });
				}
				if (error.data.code === "RAPI-1011") {
					this.setState({ noPermission: true });
				}
			});
	};

	renderError = () => {
		if (this.state.teamNotFound)
			return (
				<p className="error-message">
					<FormattedMessage
						id="teamSelection.teamNotFound"
						defaultMessage="The selected team doesn't exist."
					/>
				</p>
			);
		if (this.state.noPermission)
			return (
				<p className="error-message">
					<FormattedMessage
						id="teamSelection.noPermission"
						defaultMessage="You don't seem to be a member of the selected team."
					/>
				</p>
			);
	};

	render() {
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
				<form onSubmit={this.onSubmit}>
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
							required={this.isSelected("createTeam") && this.state.newTeamName === ""}
							value={this.state.newTeamName}
							onChange={this.onChange}
							ref={element => (this.nameInput = element)}
						/>
					</div>
					{this.state.teams.map((team, index) => {
						return (
							<div key={index} className="control-group">
								<label className="input-label">
									<input
										className="input-radio"
										type="radio"
										name="team"
										value={team.id}
										checked={this.isSelected(team.name)}
										onChange={this.onSelect}
									/>
									{team.name}
								</label>
							</div>
						);
					})}
					<Button id="submit-button" disabled={this.isFormInvalid()} loading={this.state.loading}>
						<FormattedMessage id="teamSelection.submitButton" defaultMessage="NEXT" />
					</Button>
				</form>
			</div>
		);
	}
}

export default withAPI({ createTeam })(SimpleTeamSelectionForm);
