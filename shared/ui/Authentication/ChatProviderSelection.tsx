import React from "react";
import { useDispatch } from "react-redux";
import Icon from "../Stream/Icon";
import Button from "../Stream/Button";
import { Link } from "../Stream/Link";
import {
	goToNewUserEntry,
	goToSignup,
	goToMSTeamsAdminApprovalInfo
} from "../store/context/actions";
import { startSSOSignin, SignupType } from "../store/actions";
import { HostApi } from "../webview-api";

export const ChatProviderSelection = () => {
	const dispatch = useDispatch();

	const onClickSlack = (event: React.SyntheticEvent) => {
		event.preventDefault();
		HostApi.instance.track("Team Type Selected", { "Team Type": "Slack" });
		dispatch(startSSOSignin("slack", { type: SignupType.CreateTeam }));
	};

	const onClickMSTeams = (event: React.SyntheticEvent) => {
		event.preventDefault();
		HostApi.instance.track("Team Type Selected", { "Team Type": "MSTeams" });
		dispatch(goToMSTeamsAdminApprovalInfo());
	};

	const onClickCodeStream = (event: React.SyntheticEvent) => {
		event.preventDefault();
		HostApi.instance.track("Team Type Selected", { "Team Type": "CodeStream" });
		dispatch(goToSignup({ type: SignupType.CreateTeam }));
	};

	const onClickGoBack = (event: React.SyntheticEvent) => {
		event.preventDefault();
		dispatch(goToNewUserEntry());
	};

	return (
		<div className="onboarding-page">
			<form className="standard-form">
				<fieldset className="form-body">
					<div className="outline-box">
						<h3 style={{ textAlign: "left" }}>Use Slack or Microsoft Teams Channels</h3>
						<p>
							Create a CodeStream team connected to your Slack workspace or Microsoft Teams
							organization so you can discuss code in your existing channels.
						</p>
						<div id="controls">
							<Button className="row-button" onClick={onClickSlack}>
								<Icon name="slack" />
								<div className="copy">Sign Up with Slack</div>
								<Icon name="chevron-right" />
							</Button>
							<Button className="row-button" onClick={onClickMSTeams}>
								<Icon name="msteams" />
								<div className="copy">Sign Up with Microsoft Teams</div>
								<Icon name="chevron-right" />
							</Button>
						</div>
					</div>
					<br />
					<div className="outline-box">
						<h3 style={{ textAlign: "left" }}>Use CodeStream Channels</h3>
						<p>Don't use Slack or Microsoft Teams? We'll provide the channels for you!</p>
						<div id="controls">
							<Button className="row-button" onClick={onClickCodeStream}>
								<Icon name="codestream" />
								<div className="copy">Sign Up with CodeStream</div>
								<Icon name="chevron-right" />
							</Button>
						</div>
					</div>
					<div style={{ textAlign: "center" }}>
						<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Creating-a-Team">
							Help me decide
						</a>
					</div>
					<div id="controls">
						<div className="footer">
							<Link onClick={onClickGoBack}>
								<p>{"< Back"}</p>
							</Link>
						</div>
					</div>
				</fieldset>
			</form>
		</div>
	);
};
