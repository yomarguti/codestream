import React, { Component } from "react"

export default class ConfirmEmail extends Component {
	constructor(props) {
		super(props)
		this.state = {
			values: ["", "", "", "", "", ""]
		}
	}

	onChange = index => event => {
		if (isNaN(event.target.value)) return
		const values = this.state.values.slice()
		values[index] = event.target.value
		this.setState({ values })
	}

	render() {
		const { email } = this.props

		return (
			<div id="email-confirmation">
				<h2>You're almost there!</h2>
				<p>Please check your email. We've sent you a 6-digit code to confirm your email address.</p>
				<p>
					Didn't receive it? Check your spam folder, or have us <a>send another email</a>.
				</p>
				<p>
					<strong>{email}</strong> not correct? <a>Change it</a>.
				</p>
				<div>
					<div id="inputs">
						{this.state.values.map((value, index) => (
							<input
								className="native-key-bindings input-text"
								type="text"
								maxLength="1"
								tabIndex={index}
								key={index}
								value={value}
								onChange={this.onChange(index)}
							/>
						))}
					</div>
					<button id="submit-button" className="btn inline-block-tight btn-primary">
						SUBMIT
					</button>
				</div>
			</div>
		)
	}
}
