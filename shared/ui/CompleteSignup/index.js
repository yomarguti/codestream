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
			<div id="continue-page">
				<form id="continue-form" className="standard-form" onSubmit={this.submitCredentials}>
					<fieldset className="form-body">
						<h2>CodeStream</h2>
						<FormattedMessage id={mainParagraphCopy}>{text => <p>{text}</p>}</FormattedMessage>
						<div id="controls">
							<div className="button-group">
								<Button onClick={this.handleClickContinue} className="control-button">
									<FormattedMessage id="signup.complete.button" />
								</Button>
							</div>
							{/*<div className="footer">
								<p>
									<strong>
										<a onClick={this.handleClickSignin}>Sign in</a>
									</strong>
								</p>
							</div>*/}
						</div>
					</fieldset>
				</form>
			</div>
		);
	}
}

export default connect(
	null,
	actions
)(CompleteSignup);
