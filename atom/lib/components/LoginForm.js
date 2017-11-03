import React, { Component } from "react"
import Button from "./Button"

const isPasswordInvalid = password => password.length < 6
const isEmailInvalid = email => {
	const emailRegex = new RegExp(
		"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
	)
	return email === "" || emailRegex.test(email) === false
}
const createUser = async attributes => {
	const randomNumber = Math.floor(Math.random() * (10 - 1)) + 1
	if (randomNumber % 3 === 0) return Promise.reject({ emailTaken: false })
	else return Promise.resolve({ email: attributes.email, userId: "123" })
}

export default class LoginForm extends Component {
	constructor(props) {
		super(props)
		this.state = {
			password: "",
			email: this.props.email || "",
			passwordTouched: false,
			emailTouched: false
		}
	}

	onBlurPassword = () => {
		if (this.state.passwordTouched) return
		this.setState({ passwordTouched: true })
	}

	onBlurEmail = () => {
		if (this.state.emailTouched) return
		this.setState({ emailTouched: true })
	}

	renderEmailHelp = () => {
		const { email, emailTouched } = this.state
		if (isEmailInvalid(email) && emailTouched)
			return <small className="error-message">Looks like an invalid email address!</small>
	}

	renderPasswordHelp = () => {
		const { password, passwordTouched } = this.state
		if (isPasswordInvalid(password) && passwordTouched) {
			return (
				<span className="error-message">{`${6 - password.length} more character(s) please`}</span>
			)
		}
	}

	isFormInvalid = () => {
		const { password, email } = this.state
		return isPasswordInvalid(password) || isEmailInvalid(email)
	}

	submitCredentials = async event => {
		event.preventDefault()
		if (this.isFormInvalid()) return
		this.setState({ loading: true })
		const { transition } = this.props
		const { password, email } = this.state
		createUser({ password, email, name: this.props.name })
			.then(user => transition("success", user))
			.catch(error => {
				if (error.emailTaken) transition("emailExists", email)
			})
	}

	render() {
		return (
			<form id="login-form" onSubmit={this.submitCredentials}>
				<h2>Sign In</h2>
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
							minLength="6"
							tabIndex="1"
							value={this.state.password}
							onChange={e => this.setState({ password: e.target.value })}
							onBlur={this.onBlurPassword}
							required={this.state.passwordTouched}
						/>
						{this.renderPasswordHelp()}
						<div className="help-link">
							<a>Forgot password?</a>
						</div>
					</div>
					<Button
						id="login-button"
						className="control-button"
						tabIndex="2"
						type="submit"
						disabled={this.isFormInvalid()}
					>
						SIGN IN
					</Button>
					<div className="footer">
						<p>
							<strong>Don't have an account?</strong>
						</p>
						<p>
							<strong>
								<a onClick={() => this.props.transition("signUp")}>Sign Up</a>
							</strong>
						</p>
					</div>
				</div>
			</form>
		)
	}
}
