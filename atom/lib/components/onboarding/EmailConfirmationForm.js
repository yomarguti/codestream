import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import Button from "./Button";
import * as actions from "../../actions/onboarding";

export class SimpleEmailConfirmationForm extends Component {
	constructor(props) {
		super(props);
		this.state = {
			values: ["", "", "", "", "", ""]
		};
	}

	onChange = index => event => {
		const value = event.target.value;
		if (value === "" || isNaN(value)) return;
		const values = this.state.values.slice();
		values[index] = value;
		this.setState(
			() => ({ values }),
			() => {
				const nextInput = this[`input${index + 1}`];
				if (nextInput !== undefined) nextInput.focus();
			}
		);
	};

	submitCode = () => {
		const confirmationCode = this.state.values.join("");
		const { email, userId, transition, confirmEmail, store } = this.props;
		confirmEmail({ userId, email, confirmationCode });
		this.setState({ values: this.state.values.fill("") });
		this.input0.focus();
	};

	isFormInvalid = () => this.state.values.includes("");

	renderError = () => {
		if (this.props.errors.invalidCode)
			return (
				<span className="error-message form-error">
					<FormattedMessage id="confirmation.invalid" />
				</span>
			);
		if (this.props.errors.expiredCode)
			return (
				<span className="error-message form-error">
					<FormattedMessage id="confirmation.expired" />
				</span>
			);
	};

	sendNewCode = () => {
		const { username, email, password, sendNewCode } = this.props;
		sendNewCode({ username, email, password });
	};

	render() {
		const { email } = this.props;
		const { values } = this.state;

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
						{text => (
							<a id="send-new-code" onClick={this.sendNewCode}>
								{text}
							</a>
						)}
					</FormattedMessage>
				</p>
				<p>
					<FormattedMessage id="confirmation.incorrectEmail" values={{ email }}>
						{text => {
							const [email, ...rest] = text.split(" ");
							return (
								<span>
									<strong>{email}</strong>
									{` ${rest.join(" ")} `}
								</span>
							);
						}}
					</FormattedMessage>
					<a id="go-back" onClick={this.props.goToSignup}>
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
						loading={this.props.loading}
					>
						<FormattedMessage id="confirmation.submitButton" />
					</Button>
				</div>
			</form>
		);
	}
}

const mapStateToProps = ({ onboarding }) => {
	const { userId, email, password, username } = onboarding.props;
	return {
		userId,
		attributesForNewCode: { email, password, username },
		errors: onboarding.errors,
		loading: onboarding.requestInProcess
	};
};
export default connect(mapStateToProps, actions)(SimpleEmailConfirmationForm);
