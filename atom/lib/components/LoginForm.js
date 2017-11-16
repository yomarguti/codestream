import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import Button from "./Button";

const isPasswordInvalid = password => password.length === 0;
const isEmailInvalid = email => {
	const emailRegex = new RegExp(
		"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
	);
	return email === "" || emailRegex.test(email) === false;
};

export default class LoginForm extends Component {
	static defaultProps = {
		authenticate: async ({ password }) => {
			return new Promise((resolve, reject) => {
				setTimeout(() => (password === "foobar" ? resolve() : reject()), 1000);
			});
		}
	};

	constructor(props) {
		super(props);
		this.state = {
			password: "",
			email: this.props.email || "",
			passwordTouched: false,
			emailTouched: false
		};
	}

	onBlurPassword = () => {
		if (this.state.passwordTouched) return;
		this.setState({ passwordTouched: true });
	};

	onBlurEmail = () => {
		if (this.state.emailTouched) return;
		this.setState({ emailTouched: true });
	};

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
				<span className="error-message">
					<FormattedMessage id="login.password.required" />
				</span>
			);
		}
	};

	renderAlreadySignedupMessage = () => {
		if (this.props.alreadySignedUp)
			return (
				<p>
					<FormattedMessage id="login.alreadySignedUp" />
				</p>
			);
	};

	renderError = () => {
		if (this.state.failed)
			return (
				<span className="error-message form-error">
					<FormattedMessage id="login.invalid" />
				</span>
			);
	};

	isFormInvalid = () => {
		const { password, email } = this.state;
		return isPasswordInvalid(password) || isEmailInvalid(email);
	};

	submitCredentials = async event => {
		event.preventDefault();
		if (this.isFormInvalid()) return;
		this.setState({ loading: true });
		const { authenticate, transition } = this.props;
		const { password, email } = this.state;
		authenticate({ password, email })
			.then(user => transition("success", user))
			.catch(e => {
				this.setState({ loading: false, failed: true, password: "", passwordTouched: false });
			});
	};

	render() {
		return (
			<form id="login-form" onSubmit={this.submitCredentials}>
				<h2>Sign In</h2>
				{this.renderAlreadySignedupMessage()}
				{this.renderError()}
				<div id="controls">
					<div id="email-controls" className="control-group">
						<input
							className="native-key-bindings input-text control"
							type="text"
							name="email"
							placeholder="Email Address"
							tabIndex="0"
							value={this.state.email}
							onChange={e => this.setState({ email: e.target.value })}
							onBlur={this.onBlurEmail}
							required={this.state.emailTouched}
						/>
						{this.renderEmailHelp()}
					</div>
					<div id="password-controls" className="control-group">
						<input
							className="native-key-bindings input-text"
							type="password"
							name="password"
							placeholder="Password"
							tabIndex="1"
							value={this.state.password}
							onChange={e => this.setState({ password: e.target.value })}
							onBlur={this.onBlurPassword}
							required={this.state.passwordTouched}
						/>
						{this.renderPasswordHelp()}
						<div className="help-link">
							<a onClick={() => this.props.transition("forgotPassword")}>
								<FormattedMessage id="login.forgotPassword" />
							</a>
						</div>
					</div>
					<Button
						id="login-button"
						className="control-button"
						tabIndex="2"
						type="submit"
						disabled={this.isFormInvalid()}
						loading={this.state.loading}
					>
						<FormattedMessage id="login.submitButton" />
					</Button>
					<div className="footer">
						<p>
							<strong>
								<FormattedMessage id="login.footer.noAccount" />
							</strong>
						</p>
						<p>
							<strong>
								<a onClick={() => this.props.transition("signUp")}>
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
