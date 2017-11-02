import React, { Component } from "react"
import createClassString from "classnames"

export default class ConfirmEmail extends Component {
	static defaultProps = {
		confirmEmail: async ({ code }) => {
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					if (code === "111111") resolve()
					else if (code === "123456") reject({ expiredCode: true })
					else reject({ invalidCode: true })
				}, 1000)
			})
		}
	}

	constructor(props) {
		super(props)
		this.state = {
			failCount: 0,
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
		const { email, userId, transition, confirmEmail } = this.props
		this.setState(state => ({ loading: true }))
		confirmEmail({ userId, email, code })
			.then(user => transition("success"))
			.catch(({ invalidCode, expiredCode }) => {
				if (invalidCode) {
					if (this.state.failCount === 2) return transition("back")
					this.setState({
						failCount: ++this.state.failCount,
						invalidCode: true,
						expiredCode: false,
						loading: false,
						values: this.state.values.fill("")
					})
				} else if (expiredCode) {
					this.setState({
						invalidCode: false,
						expiredCode: true,
						loading: false,
						values: this.state.values.fill("")
					})
				}
			})
	}

	isFormInvalid = () => this.state.values.includes("")

	renderError = () => {
		if (this.state.invalidCode) return <span className="error-message">Uh oh. Invalid code.</span>
		if (this.state.expiredCode)
			return <span className="error-message">Sorry, that code has expired.</span>
	}

	render() {
		const { email } = this.props
		const { values } = this.state

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
				<div id="form">
					{this.renderError()}
					<div id="inputs">
						{values.map((value, index) => (
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
