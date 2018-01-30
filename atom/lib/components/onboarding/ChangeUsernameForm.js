import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import UnexpectedErrorMessage from "./UnexpectedErrorMessage";
import Button from "./Button";
import * as onboardingActions from "../../actions/onboarding";
const { CompositeDisposable } = require("atom");

export class ChangeUsernameForm extends Component {
	constructor(props) {
		super(props);
		this.state = {
			username: "",
			touched: false,
			loading: false
		};
		this.subscriptions = new CompositeDisposable();
	}

	onBlur = () => this.setState({ touched: true });

	renderError = () => {
		if (this.props.errors.unknown)
			return <UnexpectedErrorMessage classes="error-message page-error" />;
	};

	componentDidMount() {
		this.addToolTip("change-username", "Up to 21 characters. Valid special characters are (.-_)");
	}

	addToolTip(elementId, key) {
		let div = document.getElementById(elementId);
		if (!div) return;
		this.subscriptions.add(
			atom.tooltips.add(div, {
				title: key,
				placement: "left",
				delay: 0
			})
		);
	}

	onSubmit = async event => {
		this.setState({ loading: true });
		event.preventDefault();
		if (this.state.username === "") return;
		await this.props.changeUsername(this.state.username);
		await this.props.joinTeam(this.props.nextAction);
		this.setState({ loading: false });
	};

	render() {
		return (
			<form id="change-username-form" onSubmit={this.onSubmit}>
				<h2>
					<FormattedMessage id="changeUsername.title" defaultMessage="Username Collision!" />
				</h2>
				<p>
					<FormattedMessage
						id="changeUsername.message"
						defaultMessage={`Bad news. Someone on this team already has \"{takenUsername}\" as a username. Unfortunately, you'll have to change yours.`}
						values={{ takenUsername: this.props.takenUsername }}
					/>
				</p>
				{this.renderError()}
				<div id="controls">
					<div id="username-controls" className="control-group">
						<input
							id="change-username"
							className="native-key-bindings input-text control"
							type="text"
							name="username"
							placeholder="Username"
							minLength="1"
							maxLength="21"
							tabIndex="0"
							value={this.state.username}
							onBlur={this.onBlur}
							onChange={event => this.setState({ username: event.target.value })}
						/>
					</div>
					<Button
						id="submit-button"
						className="control-button"
						tabIndex="2"
						type="submit"
						loading={this.state.loading}
					>
						<FormattedMessage id="changeUsername.submitButton" defaultMessage="UPDATE" />
					</Button>
				</div>
			</form>
		);
	}
}

const mapStateToProps = ({ onboarding }) => ({
	...onboarding.props,
	errors: onboarding.errors
});
export default connect(mapStateToProps, onboardingActions)(ChangeUsernameForm);
