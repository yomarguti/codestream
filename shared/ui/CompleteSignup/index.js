import * as React from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import Button from "../Login/Button";
import * as actions from "./actions";

export class CompleteSignup extends React.Component {
	state = {};

	// renderError = () => {
	// 	if (this.state.error.invalidCredentials)
	// 		return (
	// 			<div className="error-message form-error">
	// 				<FormattedMessage id="login.invalid" />
	// 			</div>
	// 		);
	// 	// if (this.props.errors.unknown)
	// 	// 	return <UnexpectedErrorMessage classes="error-message page-error" />;
	// };

	handleClickContinue = event => {
		event.preventDefault();
		this.props.validateSignup();
	};

	render() {
		return (
			<div id="complete-signup-page">
				<h2>Sign In to CodeStream</h2>
				<p>Once you've completed..</p>
				<Button onClick={this.handleClickContinue}>CONTINUE</Button>
				<a>Sign in</a>
			</div>
		);
	}
}

export default connect(
	null,
	actions
)(CompleteSignup);
