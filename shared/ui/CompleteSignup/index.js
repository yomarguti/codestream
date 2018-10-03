import * as React from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import Button from "../Stream/Button";
import * as actions from "./actions";
import { safe } from "../utils";

export class CompleteSignup extends React.Component {
	state = {
		signUpNotComplete: false,
		loading: false
	};

	handleClickContinue = async event => {
		event.preventDefault();
		try {
			this.setState({ loading: true });
			await this.props.validateSignup();
		} catch (error) {
			this.setState({ loading: false });
			if (error === "USER_NOT_ON_TEAM" || error === "NOT_CONFIRMED") {
				this.setState({ signUpNotComplete: true });
			} else this.props.goToLogin();
		}
	};

	handleClickSignin = event => {
		event.preventDefault();
		this.props.goToLogin();
	};

	handleClickSignup = event => {
		event.preventDefault();
		this.props.startSignup();
	};

	getMainText() {
		const id = safe(() => this.props.authType === "slack")
			? "signup.complete.withSlack"
			: "signup.complete.main";
		return <FormattedMessage id={id}>{text => <p>{text}</p>}</FormattedMessage>;
	}

	render() {
		return (
			<div className="onboarding-page">
				<form id="continue-form" className="standard-form" onSubmit={this.submitCredentials}>
					<fieldset className="form-body">
						<h2>CodeStream</h2>
						{this.state.signUpNotComplete ? (
							<p>
								Please complete <a onClick={this.handleClickSignup}>Sign Up in your browser</a>{" "}
								before continuing.
							</p>
						) : (
							this.getMainText()
						)}

						<div id="controls">
							<div className="button-group">
								<Button
									className="control-button"
									onClick={this.handleClickContinue}
									loading={this.state.loading}
								>
									<FormattedMessage id="signup.complete.button" />
								</Button>
							</div>
							<div className="footer">
								<p>
									<a onClick={this.handleClickSignin}>Cancel</a>
								</p>
							</div>
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
