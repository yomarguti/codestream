import React, { Component } from "react"

export default class Onboarding extends Component {
	constructor(props) {
		super(props)
		const { repository } = props
		this.state = {
			email: repository.getConfigValue("user.email", repository.getWorkingDirectory()),
			username: props.username || "",
			isUsernameTouched: false
		}
	}

	onBlur = () => {
		if (this.state.isUsernameTouched) return
		this.setState({ isUsernameTouched: true })
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
							pattern="^[-a-z0-9_.]{6,21}$"
							tabIndex="0"
							value={this.state.username}
							onChange={e => this.setState({ username: e.target.value })}
							onBlur={this.onBlur}
							required={this.state.isUsernameTouched}
						/>
						<small>6-21 characters</small>
					</div>
					<div className="control-group">
						<input
							className="native-key-bindings input-text control"
							type="password"
							placeholder="Password"
							minLength="6"
							tabIndex="1"
						/>
						<small>6+ characters</small>
					</div>
					<div className="control-group">
						<input
							className="native-key-bindings input-text control"
							type="email"
							placeholder="Email Address"
							value={this.state.email}
							tabIndex="2"
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
				</div>
			</div>
		)
	}
}
