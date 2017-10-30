import React, { Component } from "react"

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

	renderPasswordHelp = () => {
		const length = this.state.password.length
		if (length < 6 && this.state.passwordTouched) {
			return <span className="error-message">{`${6 - length} more character(s) please`}</span>
		}
		return <span>6 + characters</span>
	}

	render() {
		return (
			<div className="signup-form">
				<div id="controls">
					<div className="control-group">
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
						<small>6-21 characters</small>
					</div>
					<div className="control-group">
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
					<div className="control-group">
						<input
							className="native-key-bindings input-text control"
							type="email"
							name="email"
							placeholder="Email Address"
							tabIndex="2"
							value={this.state.email}
							onChange={e => this.setState({ email: e.target.value })}
							onBlur={this.onBlurEmail}
							required={this.state.emailTouched}
						/>
						<small>FYI, we got this from Git</small>
					</div>
					<button
						id="signup-button"
						className="control btn btn-primary inline-block-tight"
						tabIndex="3"
					>
						SIGN UP
					</button>
					<small>
						By clicking Sign Up, you agree to CodeStream's <a>Terms of Service</a> and{" "}
						<a>Privacy Policy</a>
					</small>
				</div>
			</div>
		)
	}
}
