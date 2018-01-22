import { shell } from "electron";
import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import getSystemUser from "username";
import Button from "./Button";
import UnexpectedErrorMessage from "./UnexpectedErrorMessage";
import withConfigs from "../withConfigs";
import * as actions from "../../actions/onboarding";
const { CompositeDisposable } = require("atom");

const isUsernameInvalid = username => new RegExp("^[-a-z0-9_.]{1,21}$").test(username) === false;
const isPasswordInvalid = password => password.length < 6;
const isEmailInvalid = email => {
	const emailRegex = new RegExp(
		"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
	);
	return email === "" || emailRegex.test(email) === false;
};
const parseName = name => {
	const names = name.split(" ");
	if (names.length > 2) return { firstName: name, lastName: "" };
	else {
		const [firstName, lastName = ""] = names;
		return { firstName, lastName };
	}
};

export class SimpleSignupForm extends Component {
	static contextTypes = {
		repositories: PropTypes.array
	};

	constructor(props) {
		super(props);
		this.state = {
			username: getSystemUser.sync(),
			password: "",
			email: "",
			usernameTouched: false,
			passwordTouched: false,
			emailTouched: false,
			usernameInUse: false
		};
		this.subscriptions = new CompositeDisposable();
	}

	componentDidMount() {
		const { repositories } = this.context;
		const repository = repositories[0];
		const gitDirectory = repository.getWorkingDirectory();
		this.setState({
			email: repository.getConfigValue("user.email", gitDirectory) || "",
			name: repository.getConfigValue("user.name", gitDirectory) || ""
		});

		this.addToolTip("onboard-input-username", "Up to 21 characters");
		this.addToolTip("onboard-input-password", "6+ characters");
		this.addToolTip("onboard-input-email", "FYI, we got this from git");
	}

	componentWillUnmount() {
		this.subscriptions.dispose();
	}

	addToolTip(elementId, key) {
		let div = document.getElementById(elementId);
		this.subscriptions.add(
			atom.tooltips.add(div, {
				title: key,
				placement: "left",
				delay: 0
			})
		);
	}

	onBlurUsername = () => {
		const { usernamesInTeam } = this.props;
		const { username } = this.state;
		this.setState({ usernameTouched: true, usernameInUse: usernamesInTeam.includes(username) });
	};

	onBlurPassword = () => {
		if (this.state.passwordTouched) return;
		this.setState({ passwordTouched: true });
	};

	onBlurEmail = () => {
		if (this.state.emailTouched) return;
		this.setState({ emailTouched: true });
	};

	renderUsernameHelp = () => {
		const { username, usernameInUse } = this.state;
		if (username.length > 21)
			return (
				<small className="error-message">
					<FormattedMessage id="signUp.username.length" />
				</small>
			);
		else if (isUsernameInvalid(username))
			return (
				<small className="error-message">
					<FormattedMessage id="signUp.username.validCharacters" />
				</small>
			);
		else if (usernameInUse)
			return (
				<small className="error-message">
					<FormattedMessage id="signUp.username.alreadyTaken" />
				</small>
			);
		else return <small>&nbsp;</small>;
	};

	renderPasswordHelp = () => {
		const { password, passwordTouched } = this.state;
		if (isPasswordInvalid(password) && passwordTouched) {
			return (
				<small className="error-message">
					<FormattedMessage
						id="signUp.password.tooShort"
						values={{ countNeeded: 6 - password.length }}
					/>
				</small>
			);
		} else return <small>&nbsp;</small>;
	};

	renderEmailHelp = () => {
		const { email, emailTouched } = this.state;
		if (emailTouched && isEmailInvalid(email))
			return (
				<small className="error-message">
					<FormattedMessage id="signUp.email.invalid" />
				</small>
			);
		else return <small>&nbsp;</small>;
	};

	isFormInvalid = () => {
		const { username, password, email } = this.state;
		return isUsernameInvalid(username) || isPasswordInvalid(password) || isEmailInvalid(email);
	};

	submitCredentials = event => {
		event.preventDefault();
		if (this.isFormInvalid()) return;
		this.setState({ loading: true });
		const { register } = this.props;
		const { username, password, email, name } = this.state;
		register({ username, password, email, ...parseName(name) }).then(() =>
			this.setState({ loading: false })
		);
	};

	renderDebugInfo() {
		const apiPath = this.props.configs.url;
		if (atom.inDevMode() && apiPath) return <p>{apiPath}</p>;
	}

	renderPageErrors() {
		if (this.props.errors.unknown)
			return <UnexpectedErrorMessage classes="error-message page-error" />;
	}

	render() {
		return (
			<form id="signup-form" onBlur={this.onBlurUsername} onSubmit={this.submitCredentials}>
				{this.renderDebugInfo()}
				<h2>Sign Up for CodeStream</h2>
				{this.renderPageErrors()}
				<div id="controls">
					<div id="email-controls" className="control-group">
						<label>
							<FormattedMessage id="signUp.email.label" />
						</label>
						<input
							id="onboard-input-email"
							className="native-key-bindings input-text"
							type="text"
							name="email"
							placeholder="Email Address"
							tabIndex="2"
							value={this.state.email}
							onChange={e => this.setState({ email: e.target.value })}
							onBlur={this.onBlurEmail}
							required={this.state.emailTouched}
						/>
						{this.renderEmailHelp()}
					</div>
					<div id="username-controls" className="control-group">
						<label>
							<FormattedMessage id="signUp.username.label" />
						</label>
						<input
							id="onboard-input-username"
							className="native-key-bindings input-text"
							type="text"
							name="username"
							placeholder="Username"
							minLength="1"
							maxLength="21"
							tabIndex="0"
							value={this.state.username}
							onChange={event => this.setState({ username: event.target.value })}
							onBlur={this.onBlurUsername}
							required={this.state.usernameTouched}
						/>
						{this.renderUsernameHelp()}
					</div>
					<div id="password-controls" className="control-group">
						<label>
							<FormattedMessage id="signUp.password.label" />
						</label>
						<input
							id="onboard-input-password"
							className="native-key-bindings input-text"
							type="password"
							name="password"
							tabIndex="1"
							value={this.state.password}
							onChange={e => this.setState({ password: e.target.value })}
							onBlur={this.onBlurPassword}
							required={this.state.passwordTouched}
						/>
						{this.renderPasswordHelp()}
					</div>
					<Button
						id="signup-button"
						className="control-button"
						tabIndex="3"
						type="submit"
						// disabled={this.isFormInvalid()}
						loading={this.state.loading}
					>
						<FormattedMessage id="signUp.submitButton" />
					</Button>
					<small className="fine-print">
						<FormattedMessage id="signUp.legal.start" />{" "}
						<a onClick={() => shell.openExternal("https://codestream.com/tos")}>
							<FormattedMessage id="signUp.legal.termsOfService" />
						</a>{" "}
						<FormattedMessage id="and" />{" "}
						<a onClick={() => shell.openExternal("https://codestream.com/privacy")}>
							<FormattedMessage id="signUp.legal.privacyPolicy" />
						</a>
					</small>
					<div className="footer">
						<p>
							<strong>
								<FormattedMessage id="signUp.footer.alreadySignedUp" />
							</strong>
						</p>
						<p>
							<strong>
								<a onClick={this.props.goToLogin}>
									<FormattedMessage id="signUp.footer.signIn" />
								</a>
							</strong>
						</p>
					</div>
				</div>
			</form>
		);
	}
}

const mapStateToProps = ({ context, onboarding }) => ({
	usernamesInTeam: context.usernamesInTeam,
	errors: onboarding.errors
});
export default connect(mapStateToProps, actions)(withConfigs(SimpleSignupForm));
