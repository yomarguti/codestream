import React, { Component } from "react"
import cx from "classnames"

const isUsernameInvalid = username => new RegExp("^[-a-z0-9_.]{6,21}$").test(username) === false
const isPasswordInvalid = password => password.length < 6
const isEmailInvalid = email => {
	const emailRegex = new RegExp(
		"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
	)
	return email.leng === "" || emailRegex.test(email) === false
}

export default class Onboarding extends Component {
	constructor(props) {
		super(props)
		const { repository } = props
		this.state = {
			username: props.username || "",
			password: "",
			email: this.props.email || "",
			usernameTouched: false,
			passwordTouched: false,
			emailTouched: false
		}
	}

	onBlurUsername = () => {
		if (this.state.usernameTouched) return
		this.setState({ usernameTouched: true })
	}

	onBlurPassword = () => {
		if (this.state.passwordTouched) return
		this.setState({ passwordTouched: true })
	}

	onBlurEmail = () => {
		if (this.state.emailTouched) return
		this.setState({ emailTouched: true })
	}

	renderUsernameHelp = () => {
		const { username } = this.state
		if (username.length < 6 || username.length > 21)
			return <small className="error-message">6-21 characters</small>
		else if (isUsernameInvalid(username))
			return <small className="error-message">Valid special characters are (.-_)</small>
		else return <small>6-21 characters</small>
	}

	renderPasswordHelp = () => {
		const { password, passwordTouched } = this.state
		if (isPasswordInvalid(password) && passwordTouched) {
			return (
				<span className="error-message">{`${6 - password.length} more character(s) please`}</span>
			)
		}
		return <span>6+ characters</span>
	}

	renderEmailHelp = () => {
		const { email } = this.state
		if (isEmailInvalid(email))
			return <small className="error-message">That looks like an invalid email address</small>
		else return <small>FYI, we got this from Git</small>
	}

	isFormInvalid = () => {
		const { username, password, email } = this.state
		return isUsernameInvalid(username) || isPasswordInvalid(password) || isEmailInvalid(email)
	}

	submitCredentials = () => {
		if (this.isFormInvalid()) return
		this.setState({ loading: true })
		setTimeout(() => this.setState({ loading: false }), 4000)
	}

	render() {
		return (
			<form className="signup-form" onSubmit={this.submitCredentials}>
				<div id="controls">
					<div id="username-controls" className="control-group">
						<input
							className="native-key-bindings input-text control"
							type="text"
							name="username"
							placeholder="Username"
							minLength="6"
							maxLength="21"
							pattern="[-a-z0-9_.]{6,21}"
							tabIndex="0"
							value={this.state.username}
							onChange={e => this.setState({ username: e.target.value })}
							onBlur={this.onBlurUsername}
							required={this.state.usernameTouched}
						/>
						{this.renderUsernameHelp()}
					</div>
					<div id="password-controls" className="control-group">
						<input
							className="native-key-bindings input-text control"
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
							className="native-key-bindings input-text control"
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
					<button
						id="signup-button"
						className={cx("control btn inline-block-tight", { "btn-primary": !this.state.loading })}
						tabIndex="3"
						disabled={this.state.loading || this.isFormInvalid()}
						onClick={this.submitCredentials}
					>
						{this.state.loading ? (
							<span className="loading loading-spinner-tiny inline-block" />
						) : (
							"SIGN UP"
						)}
					</button>
					<small>
						By clicking Sign Up, you agree to CodeStream's <a>Terms of Service</a> and{" "}
						<a>Privacy Policy</a>
					</small>
				</div>
			</form>
		)
	}
}
