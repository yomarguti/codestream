import React, { Component } from "react"
import createClassString from "classnames"

const confirmEmail = async parameters => {
	return new Promise(resolve => setTimeout(resolve, 1000))
}

export default class ConfirmEmail extends Component {
	constructor(props) {
		super(props)
		this.state = {
			values: ["", "", "", "", "", ""],
			loading: false
		}
	}

	onChange = index => event => {
		const value = event.target.value
		if (isNaN(value)) return
		const values = this.state.values.slice()
		values[index] = value
		this.setState({ values })
	}

	goToSignup = () => this.props.transition("back")

	submitCode = async () => {
		const code = this.state.values.join("")
		const { email, userId, transition } = this.props
		this.setState(state => ({ loading: true }))
		confirmEmail({ userId, email, code }).then(user => transition("success"))
	}

	isFormInvalid = () => this.state.values.includes("")

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
					<strong>{email}</strong> not correct?{" "}
					<a id="go-back" onClick={this.goToSignup}>
						Change it
					</a>.
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
					<button
						id="submit-button"
						className={createClassString("control btn inline-block-tight", {
							"btn-primary": !this.state.loading
						})}
						disabled={this.state.loading || this.isFormInvalid()}
						onClick={this.submitCode}
					>
						{this.state.loading ? (
							<span className="loading loading-spinner-tiny inline-block" />
						) : (
							"SUBMIT"
						)}
					</button>
				</div>
			</div>
		)
	}
}
