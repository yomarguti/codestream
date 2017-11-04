import React, { Component } from "react"
import { shell } from "electron"
import Button from "./Button"

const isUsernameInvalid = username => new RegExp("^[-a-z0-9_.]{6,21}$").test(username) === false
const isPasswordInvalid = password => password.length < 6
const isEmailInvalid = email => {
	const emailRegex = new RegExp(
		"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
	)
	return email === "" || emailRegex.test(email) === false
}

export default class SignupForm extends Component {
	static defaultProps = {
		createUser: async attributes => {
			const randomNumber = Math.floor(Math.random() * (10 - 1)) + 1
			if (randomNumber % 3 === 0) return Promise.reject({ usernameTaken: true, emailExists: false })
			else return Promise.resolve({ email: attributes.email, userId: "123" })
		}
	}

	constructor(props) {
		super(props)
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
		const { username, usernameTaken } = this.state
		if (username.length < 6 || username.length > 21)
			return <small className="error-message">6-21 characters</small>
		else if (isUsernameInvalid(username))
			return <small className="error-message">Valid special characters are (.-_)</small>
		else if (usernameTaken)
			return <small className="error-message">Sorry, someone already grabbed that username.</small>
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
			return <small className="error-message">Looks like an invalid email address!</small>
		else return <small>FYI, we got this from Git</small>
	}

	isFormInvalid = () => {
		const { username, password, email } = this.state
		return isUsernameInvalid(username) || isPasswordInvalid(password) || isEmailInvalid(email)
	}

	submitCredentials = async event => {
		event.preventDefault()
		if (this.isFormInvalid()) return
		this.setState({ loading: true })
		const { createUser, transition, name } = this.props
		const { username, password, email } = this.state
		createUser({ username, password, email, name })
			.then(user => transition("success", user))
			.catch(error => {
				if (error.usernameTaken) this.setState({ loading: false, usernameTaken: true })
				else if (error.emailExists) transition("emailExists", { email, alreadySignedUp: true })
			})
	}

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
						SIGN UP
					</Button>
					<small>
						By clicking Sign Up, you agree to CodeStream's{" "}
						<a onClick={() => shell.openExternal("https://codestream.com")}>Terms of Service</a> and{" "}
						<a onClick={() => shell.openExternal("https://codestream.com")}>Privacy Policy</a>
					</small>
					<div className="footer">
						<p>
							<strong>Already have an account?</strong>
						</p>
						<p>
							<strong>
								<a onClick={() => this.props.transition("alreadySignedUp")}>Sign In</a>
							</strong>
						</p>
					</div>
				</div>
			</form>
		)
	}
}
