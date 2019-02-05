import * as React from "react";
import { connect } from "react-redux";
import { startSlackSignin } from "../Signup/actions";
import { goToSignup } from "../store/route/actions";
import Button from "../Stream/Button";

interface Props {
	goToSignup: typeof goToSignup;
	startSlackSignin: typeof startSlackSignin;
}

export const SlackInfo = connect(
	null,
	{ goToSignup, startSlackSignin }
)(function Component(props: Props) {
	return (
		<div className="onboarding-page">
			<h2>Workspace Access</h2>
			<form id="continue-form" className="standard-form">
				<fieldset className="form-body">
					<p>
						Heads up on the Slack permissions request coming next -- the permissions you are about
						to grant are for us to provide a rich Slack experience within your IDE. All
						communication with Slack is between your local machine and Slack. Your Slack messages do
						NOT go to CodeStream's servers.
					</p>
					<p style={{ textAlign: "center" }}>
						<a href="https://www.codestream.com/security">
							Learn more about CodeStream's security.
						</a>
					</p>
					<div id="controls">
						<div className="button-group">
							<Button
								className="control-button"
								type="submit"
								onClick={e => {
									e.preventDefault();
									props.startSlackSignin();
								}}
							>
								Connect to Slack
							</Button>
						</div>
						<div className="footer">
							<p>
								<a
									onClick={e => {
										e.preventDefault();
										props.goToSignup();
									}}
								>
									Cancel
								</a>
							</p>
						</div>
					</div>
				</fieldset>
			</form>
		</div>
	);
});
