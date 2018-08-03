import * as React from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import Button from "../Login/Button";
import * as actions from "./actions";

export class CompleteSignup extends React.Component {
	state = {
		signUpNotComplete: false
	};

	handleClickContinue = async event => {
		event.preventDefault();
		try {
			await this.props.validateSignup();
		} catch (error) {
			if (error === "USER_NOT_ON_TEAM") {
				this.setState({ signUpNotComplete: true });
			} else this.props.goToLogin();
		}
	};

	handleClickSignin = event => {
		event.preventDefault();
		this.props.goToLogin();
	};

	render() {
		const mainParagraphCopy = this.state.signUpNotComplete
			? "signup.complete.notComplete"
			: "signup.complete.main";

		return (
			<div>
				<h2>CodeStream</h2>
				<FormattedMessage id={mainParagraphCopy}>{text => <p>{text}</p>}</FormattedMessage>
				<Button onClick={this.handleClickContinue}>
					<FormattedMessage id="signup.complete.button" />
				</Button>
				<a onClick={this.handleClickSignin}>Sign in</a>
			</div>
		);
	}
}

export default connect(
	null,
	actions
)(CompleteSignup);
