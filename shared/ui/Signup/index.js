import * as React from "react";
import { connect } from "react-redux";
import Button from "../Stream/Button";
import * as actions from "./actions";

const Signup = props => {
	return (
		<div className="onboarding-page">
			<h2>Chat in Your IDE!</h2>
			<form className="standard-form">
				<fieldset className="form-body">
					<p>
						Access your team&#8216;s existing channels and DMs right inside your IDE, and make it
						unbelievably easy to talk about code.
					</p>
					<p>
						CodeStream saves all of these discussions as annotations to your codebase, so your team
						builds up a knowledge base over time.
					</p>
					<div id="controls">
						<div className="button-group">
							<Button className="control-button" type="button">
								Sign Up with Slack
							</Button>
						</div>
					</div>
					<br />
					<p>Don&#8216;t use Slack? Create Channels using CodeStream.</p>
					<div id="controls">
						<div className="button-group">
							<Button className="control-button" type="button">
								Use CodeStream Channels
							</Button>
						</div>
					</div>
					<br />
					<div className="footer">
						<p>
							Have an account or an access token? <a onClick={props.goToLogin}>Sign In</a>
						</p>
					</div>
				</fieldset>
			</form>
		</div>
	);
};

export default connect(
	state => ({ initialEmail: state.configs.email, pluginVersion: state.pluginVersion }),
	actions
)(Signup);
