import { shell } from "electron";
import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import getSystemUser from "username";
import Button from "./Button";
import * as actions from "../../actions/onboarding";

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
	}

	componentDidMount() {
		const { repositories } = this.context;
		const repository = repositories[0];
		const gitDirectory = repository.getWorkingDirectory();
		this.setState({
			email: repository.getConfigValue("user.email", gitDirectory),
			name: repository.getConfigValue("user.name", gitDirectory)
		});
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
		if (username.length === 0 || username.length > 21)
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
		else
			return (
				<small>
					<FormattedMessage id="signUp.username.length" />
				</small>
			);
	};

	renderPasswordHelp = () => {
		const { password, passwordTouched } = this.state;
		if (isPasswordInvalid(password) && passwordTouched) {
			return (
				<span className="error-message">
					<FormattedMessage
						id="signUp.password.tooShort"
						values={{ countNeeded: 6 - password.length }}
					/>
				</span>
			);
		}
		return (
			<span>
				<FormattedMessage id="signUp.password.help" />
			</span>
		);
	};

	renderEmailHelp = () => {
		const { email } = this.state;
		if (isEmailInvalid(email))
			return (
				<small className="error-message">
					<FormattedMessage id="signUp.email.invalid" />
				</small>
			);
		else
			return (
				<small>
					<FormattedMessage id="signUp.email.help" />
				</small>
			);
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
		register({ username, password, email, ...parseName(name) });
	};

	render() {
		return (
			<form id="signup-form" onSubmit={this.submitCredentials}>
				<div id="controls">
					<div id="username-controls" className="control-group">
						<input
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
						<input
							className="native-key-bindings input-text"
							type="password"
							name="password"
							placeholder="Password"
							minLength="6"
							tabIndex="1"
							value={this.state.password}
							onChange={e => this.setState({ password: e.target.value })}
							onBlur={this.onBlurPassword}
							required={this.state.passwordTouched}
						/>
						{this.renderPasswordHelp()}
					</div>
					<div id="email-controls" className="control-group">
						<input
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
					<Button
						id="signup-button"
						className="control-button"
						tabIndex="3"
						type="submit"
						disabled={this.isFormInvalid()}
						loading={this.state.loading}
					>
						<FormattedMessage id="signUp.submitButton" />
					</Button>
					<small>
						<FormattedMessage id="signUp.legal.start" />{" "}
						<a onClick={() => shell.openExternal("https://codestream.com")}>
							<FormattedMessage id="signUp.legal.termsOfService" />
						</a>{" "}
						<FormattedMessage id="and" />{" "}
						<a onClick={() => shell.openExternal("https://codestream.com")}>
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

const mapStateToProps = ({ context }) => ({ usernamesInTeam: context.usernamesInTeam });
export default connect(mapStateToProps, actions)(SimpleSignupForm);
