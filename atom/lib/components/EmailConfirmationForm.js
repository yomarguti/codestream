import React, { Component } from "react"
import { injectIntl, FormattedMessage } from "react-intl"
import PropTypes from "prop-types"
import Button from "./Button"
import { post } from "../network-request"

class EmailConfirmationForm extends Component {
	static contextTypes = {
		intl: PropTypes.shape({ formatMessage: PropTypes.func.isRequired })
	}

	static defaultProps = {
		confirmEmail: async ({ email, userId, code }) => {
			const params = {
				email: email,
				user_id: userId,
				confirmation_code: code
			}
			post("http://localhost:12079/no-auth/confirm", params)
		},
		sendCode: async attributes => Promise.resolve()
	}

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
		this.setState(
			() => ({ values }),
			() => {
				const nextInput = this[`input${index + 1}`]
				if (nextInput !== undefined) nextInput.focus()
			}
		)
	}

	goToSignup = () => this.props.transition("back")

	submitCode = async () => {
		const code = this.state.values.join("")
		const { email, _id, transition, confirmEmail } = this.props
		this.setState(state => ({ loading: true }))
		confirmEmail({ userId: _id, email, code })
			.then(user => transition("success"))
			.catch(({ data }) => {
				if (data.code === "USRC-1006") transition("alreadyConfirmed")
				if (data.code === "USRC-1004") transition("back")
				if (data.code === "USRC-1002") {
					this.setState({
						invalidCode: true,
						expiredCode: false,
						loading: false,
						values: this.state.values.fill("")
					})
				}
				if (data.code === "USRC-1003") {
					this.setState({
						invalidCode: false,
						expiredCode: true,
						loading: false,
						values: this.state.values.fill("")
					})
				}
				this.input0.focus()
			})
	}

	isFormInvalid = () => this.state.values.includes("")

	renderError = () => {
		if (this.state.invalidCode)
			return (
				<span className="error-message form-error">
					<FormattedMessage id="confirmation.invalid" />
				</span>
			)
		if (this.state.expiredCode)
			return (
				<span className="error-message form-error">
					<FormattedMessage id="confirmation.expired" />
				</span>
			)
	}

	sendNewCode = () => {
		const { userId, email, sendCode } = this.props
		const { intl } = this.context
		sendCode({ userId, email }).then(() => {
			atom.notifications.addInfo(intl.formatMessage({ id: "confirmation.emailSent" }))
		})
	}

	render() {
		const { email } = this.props
		const { values } = this.state

		return (
			<form id="email-confirmation" onSubmit={this.submitCode}>
				<h2>
					<FormattedMessage id="confirmation.header" />
				</h2>
				<p>
					<FormattedMessage id="confirmation.instructions" />
				</p>
				<p>
					<FormattedMessage id="confirmation.didNotReceive" />{" "}
					<FormattedMessage id="confirmation.sendAnother">
						{text => <a onClick={this.sendNewCode}>{text}</a>}
					</FormattedMessage>
				</p>
				<p>
					<FormattedMessage id="confirmation.incorrectEmail" values={{ email }}>
						{text => {
							const [email, ...rest] = text.split(" ")
							return (
								<span>
									<strong>{email}</strong>
									{` ${rest.join(" ")} `}
								</span>
							)
						}}
					</FormattedMessage>
					<a id="go-back" onClick={this.goToSignup}>
						<FormattedMessage id="confirmation.changeEmail" />
					</a>
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
								ref={element => (this[`input${index}`] = element)}
								key={index}
								value={value}
								onChange={this.onChange(index)}
							/>
						))}
					</div>
					<Button
						id="submit-button"
						type="submit"
						disabled={this.isFormInvalid()}
						loading={this.state.loading}
					>
						<FormattedMessage id="confirmation.submitButton" />
					</Button>
				</div>
			</form>
		)
	}
}

export default EmailConfirmationForm
