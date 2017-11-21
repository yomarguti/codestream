import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import Button from "./Button";

export default class TeamCreation extends Component {
	constructor(props) {
		super(props);
		this.state = {
			name: "",
			nameTouched: false
		};
	}

	onBlurName = () => this.setState(state => ({ nameTouched: true }));

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
				<form>
					<input
						className="native-key-bindings input-text control"
						placeholder="Team Name"
						onChange={event => this.setState(state => ({ name: event.target.value }))}
						onBlur={this.onBlurName}
						required={this.state.touched}
					/>
					<Button id="submit-button" disabled={this.state.name === ""}>
						<FormattedMessage id="createTeam.submitButton" />
					</Button>
				</form>
			</div>
		);
	}
}
