import React from "react";
import Button from "../Stream/Button";
import Icon from "../Stream/Icon";
import { connect } from "react-redux";
import { CodeStreamState } from "../store";
import { Link } from "../Stream/Link";
import { goToLogin, goToJoinTeam, goToSignup } from "../store/context/actions";
import { DispatchProp } from "../store/common";
import { HostApi } from "../webview-api";
import { SignupType } from "./actions";
import { JoinTeam } from "./JoinTeam";

interface ConnectedProps {
	pluginVersion: string;
	whichServer: string;
	onPrem: boolean;
}

interface Props extends ConnectedProps, DispatchProp {}

const mapStateToProps = (state: CodeStreamState) => {
	let whichServer = state.configs.serverUrl;
	const serverMatch = whichServer.match(/^https:\/\/(.*?)\.codestream\.(us|com)(:[0-9]+)?\/?$/);
	let onPrem = true;
	if (serverMatch && serverMatch[1] !== "oppr" && serverMatch[1] !== "opbeta") {
		onPrem = false;
		whichServer = "CodeStream's cloud service";
		if (serverMatch[1]) {
			if (serverMatch[1] === "localhost") {
				whichServer += ` (local)`;
			} else {
				const parts = serverMatch[1].split("-");
				if (parts[0] !== "api") {
					whichServer += ` (${parts[0].toUpperCase()})`;
				}
			}
		}
	}
	return { pluginVersion: state.pluginVersion, whichServer, onPrem };
};

export const NewUserEntry = (connect(mapStateToProps) as any)((props: Props) => {
	const onClickCreateTeam = (event: React.SyntheticEvent) => {
		event.preventDefault();
		HostApi.instance.track("Reg Path Selected", {
			"Reg Path": "Create Team"
		});
		props.dispatch(goToSignup({ type: SignupType.CreateTeam }));
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
			<form className="standard-form">
				<fieldset className="form-body">
					<div className="outline-box2">
						<h2>Try CodeStream, for free</h2>
						<div id="controls">
							<JoinTeam />
							<Button className="row-button" onClick={onClickCreateTeam}>
								<Icon name="plus" className="extra-pad" />
								<div className="copy">
									Create a team
									<div className="small">Get your dev team on CodeStream</div>
								</div>
								<Icon name="chevron-right" />
							</Button>
						</div>
					</div>
					<div id="controls">
						<div className="footer">
							<div>
								<p>
									Already have an account? <Link onClick={onClickLogin}>Sign In</Link>
								</p>
							</div>
							<div>
								<p style={{ opacity: 0.5, fontSize: ".9em", textAlign: "center" }}>
									Connected to {props.whichServer}.{" "}
									{!props.onPrem && (
										<a href="https://docs.codestream.com/userguide/faq/on-prem/">
											Looking for on-prem?
										</a>
									)}
									<br />
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
