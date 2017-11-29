import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import withAPI from "./withAPI";
import Button from "./Button";
import { createTeam } from "../../actions/team";

export class SimpleTeamCreationForm extends Component {
	constructor(props) {
		super(props);
		this.state = {
			name: "",
			nameTouched: false
		};
	}

	onBlurName = () => this.setState(state => ({ nameTouched: true }));

	onSubmit = () => {
		this.setState({ loading: true });
		const { store, createTeam, transition } = this.props;
		const { name } = this.state;
		const { url, firstCommitHash } = store.getState().repoMetadata;
		createTeam({ name, url, firstCommitHash })
			.then(data => {
				this.setState({ loading: false });
				transition("success");
			})
			.catch(error => {
				this.setState({ loading: false });
				atom.notifications.addError("There was an error creating the team");
				console.log("there was an error creating this team", error);
			});
	};

	render() {
		return (
			<div id="team-creation">
				<h2>
					<FormattedMessage id="createTeam.header" />
				</h2>
				<p>
					<FormattedMessage id="createTeam.info" />
				</p>
				<p>
					<FormattedMessage id="createTeam.additionalInfo" />
				</p>
				<form onSubmit={this.onSubmit}>
					<input
						className="native-key-bindings input-text control"
						placeholder="Team Name"
						onChange={event => this.setState({ name: event.target.value })}
						value={this.state.name}
						onBlur={this.onBlurName}
						required={this.state.touched}
					/>
					<Button id="submit-button" disabled={this.state.name === ""} loading={this.state.loading}>
						<FormattedMessage id="createTeam.submitButton" />
					</Button>
				</form>
			</div>
		);
	}
}

export default withAPI({ createTeam })(SimpleTeamCreationForm);
