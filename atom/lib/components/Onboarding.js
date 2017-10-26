import React, { Component } from "react"

export default class Onboarding extends Component {
	constructor() {
		super()
		this.state = {}
	}

	render() {
		return (
			<div className="signup-form">
				<div id="controls">
					<input
						className="native-key-bindings input-text control"
						type="text"
						placeholder="Username"
						tabIndex="0"
					/>
					<input
						className="native-key-bindings input-text control"
						type="password"
						placeholder="Password"
						tabIndex="1"
					/>
					<input
						className="native-key-bindings input-text control"
						type="email"
						placeholder="Email Address"
						tabIndex="2"
					/>
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
