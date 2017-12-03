import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import Button from "./Button";
import { createTeam } from "../../actions/onboarding";

export class SimpleTeamCreationForm extends Component {
	constructor(props) {
		super(props);
		this.state = {
			name: "",
			nameTouched: false
		};
	}

	onBlurName = () => this.setState(state => ({ nameTouched: true }));

	onSubmit = () => this.props.createTeam(this.state.name);

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
					<Button id="submit-button" disabled={this.state.name === ""} loading={this.props.loading}>
						<FormattedMessage id="createTeam.submitButton" />
					</Button>
				</form>
			</div>
		);
	}
}

const mapStateToProps = ({ onboarding }) => ({
	loading: onboarding.requestInProcess
});
export default connect(mapStateToProps, { createTeam })(SimpleTeamCreationForm);
