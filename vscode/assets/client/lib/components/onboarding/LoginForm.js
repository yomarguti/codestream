import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import UnexpectedErrorMessage from "./UnexpectedErrorMessage";
import Button from "./Button";
import Tooltip from "../Tooltip";
import * as actions from "../../actions/onboarding";

const isPasswordInvalid = password => password.length === 0;
const isEmailInvalid = email => {
	const emailRegex = new RegExp(
		"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
	);
	return email === "" || emailRegex.test(email) === false;
};

export class SimpleLoginForm extends Component {
	static contextTypes = {
		platform: PropTypes.object
	};

	constructor(props) {
		super(props);
		this.state = {
			password: "",
			email: props.email || "",
			passwordTouched: false,
			emailTouched: false
		};
	}

	async componentDidMount() {
		const { platform } = this.context;

		const repositories = await platform.getRepositories();
		if (repositories.length > 0) {
			const repository = repositories[0];
			const gitDirectory = repository.getWorkingDirectory();
			this.setState({
				email: repository.getConfigValue("user.email", gitDirectory) || ""
			});
		}
	}

	onBlurPassword = () => this.setState({ passwordTouched: true });

	onBlurEmail = () => this.setState({ emailTouched: true });

	renderEmailHelp = () => {
		const { email, emailTouched } = this.state;
		if (isEmailInvalid(email) && emailTouched)
			return (
				<small className="error-message">
					<FormattedMessage id="login.email.invalid" />
				</small>
			);
	};

	renderPasswordHelp = () => {
		const { password, passwordTouched } = this.state;
		if (isPasswordInvalid(password) && passwordTouched) {
			return (
				<small className="error-message">
					<FormattedMessage id="login.password.required" />
				</small>
			);
		}
	};

	renderAccountMessage = () => {
		if (this.props.alreadySignedUp)
			return (
				<p>
					<FormattedMessage id="login.alreadySignedUp" />
				</p>
			);
		if (this.props.alreadyConfirmed)
			return (
				<p>
					<FormattedMessage id="login.alreadyConfirmed" />
				</p>
			);
	};

	renderError = () => {
		if (this.props.errors.invalidCredentials)
			return (
				<span className="error-message form-error">
					<FormattedMessage id="login.invalid" />
				</span>
			);
		if (this.props.errors.unknown)
			return <UnexpectedErrorMessage classes="error-message page-error" />;
	};

	isFormInvalid = () => {
		const { password, email } = this.state;
		return isPasswordInvalid(password) || isEmailInvalid(email);
	};

	submitCredentials = async event => {
		event.preventDefault();
		if (this.isFormInvalid()) return;
		const { password, email } = this.state;
		this.props.authenticate({ password, email });
	};

	renderDebugInfo() {
		const apiPath = sessionStorage.getItem("codestream.url");
		if (this.context.platform.inDevMode() && apiPath) return <p>{apiPath}</p>;
	}

	render() {
		return (
			<form id="login-form" onSubmit={this.submitCredentials}>
				{this.renderDebugInfo()}
				<h2>Sign In to CodeStream</h2>
				{this.renderAccountMessage()}
				{this.renderError()}
				<div id="controls">
					<div id="email-controls" className="control-group">
						<label>
							<FormattedMessage id="login.email.label" />
						</label>
						<Tooltip
							title="The email address for your CodeStream account"
							delay="0"
							placement="left"
						>
							<input
								className="native-key-bindings input-text control"
								type="text"
								name="email"
								tabIndex="0"
								value={this.state.email}
								onChange={e => this.setState({ email: e.target.value })}
								onBlur={this.onBlurEmail}
								required={this.state.emailTouched}
							/>
						</Tooltip>
						{this.renderEmailHelp()}
					</div>
					<div id="password-controls" className="control-group">
						<label>
							<FormattedMessage id="login.password.label" />
						</label>
						<Tooltip title="Your CodeStream password" delay="0" placement="left">
							<input
								className="native-key-bindings input-text"
								type="password"
								name="password"
								tabIndex="1"
								value={this.state.password}
								onChange={e => this.setState({ password: e.target.value })}
								onBlur={this.onBlurPassword}
								required={this.state.passwordTouched}
							/>
						</Tooltip>
						{this.renderPasswordHelp()}
						{/* <div className="help-link">
							<a onClick={() => this.props.transition("forgotPassword")}>
								<FormattedMessage id="login.forgotPassword" />
							</a>
						</div> */}
					</div>
					<Button
						id="login-button"
						className="control-button"
						tabIndex="2"
						type="submit"
						loading={this.props.loading}
					>
						<FormattedMessage id="login.submitButton" />
					</Button>
					<div className="footer">
						<p>
							<strong>
								<FormattedMessage id="login.footer.noAccount" />{" "}
								<a onClick={this.props.goToSignup}>
									<FormattedMessage id="login.footer.signUp" />
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
	...onboarding.props,
	errors: onboarding.errors,
	loading: onboarding.requestInProcess
});
export default connect(mapStateToProps, actions)(SimpleLoginForm);
