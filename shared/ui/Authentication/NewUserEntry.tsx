import React from "react";
import Button from "../Stream/Button";
import { connect } from "react-redux";
import { CodeStreamState } from "../store";
import { Link } from "../Stream/Link";
import { goToLogin, goToCSOrSlack, goToJoinTeam } from "../store/context/actions";
import { DispatchProp } from "../store/common";
import { HostApi } from "../webview-api";

interface ConnectedProps {
	pluginVersion: string;
}

interface Props extends ConnectedProps, DispatchProp {}

const mapStateToProps = (state: CodeStreamState) => ({ pluginVersion: state.pluginVersion });

export const NewUserEntry = (connect(mapStateToProps) as any)((props: Props) => {
	const onClickCreateTeam = (event: React.SyntheticEvent) => {
		event.preventDefault();
		HostApi.instance.track("Reg Path Selected", {
			"Reg Path": "Create Team"
		});
		props.dispatch(goToCSOrSlack());
	};

	const onClickJoinTeam = (event: React.SyntheticEvent) => {
		event.preventDefault();
		HostApi.instance.track("Reg Path Selected", {
			"Reg Path": "Join Team"
		});
		props.dispatch(goToJoinTeam());
	};

	const onClickLogin = (event: React.SyntheticEvent) => {
		event.preventDefault();
		props.dispatch(goToLogin());
	};

	return (
		<div className="onboarding-page">
			<h2>CodeStream</h2>
			<form className="standard-form">
				<fieldset className="form-body">
					<p>
						If anyone at your organization has already created a team, ask to be invited. Otherwise,
						create a team to get things started!
					</p>
					<div id="controls">
						<div className="button-group">
							<Button className="control-button" type="button" onClick={onClickCreateTeam}>
								Create a New Team
							</Button>
						</div>
					</div>
					<div id="controls">
						<div className="button-group">
							<Button className="control-button" type="button" onClick={onClickJoinTeam}>
								Join an Existing Team
							</Button>
						</div>
					</div>
					<br />
					<div id="controls">
						<div className="footer">
							<div>
								<p>
									Already have an account? <Link onClick={onClickLogin}>Sign In</Link>
								</p>
							</div>
							<div>
								<p style={{ opacity: 0.5, fontSize: ".9em" }}>
									CodeStream Version {props.pluginVersion}
								</p>
							</div>
						</div>
					</div>
				</fieldset>
			</form>
		</div>
	);
});
