import React from "react";
import Button from "../Stream/Button";
import { Link } from "../Stream/Link";
import Icon from "../Stream/Icon";
import { HostApi } from "../webview-api";
import { useDispatch } from "react-redux";
import { startSSOSignin, SignupType } from "../store/actions";
import { goToChatProviderSelection } from "../store/context/actions";

const azureUrl = "https://www.codestream.com/azure";

export function MSTeamsAdminApprovalInfo() {
	const dispatch = useDispatch();

	const onClickSignUp = (event: React.SyntheticEvent) => {
		event.preventDefault();
		HostApi.instance.track("AAD Admin Consented");
		dispatch(startSSOSignin("msteams", { type: SignupType.CreateTeam }));
	};

	const onClickGoBack = (event: React.SyntheticEvent) => {
		event.preventDefault();
		dispatch(goToChatProviderSelection());
	};

	return (
		<div className="onboarding-page">
			<form className="standard-form">
				<fieldset className="form-body">
					<div className="outline-box">
						<h3 style={{ textAlign: "left" }}>Get Admin Approval</h3>
						<p>
							Provide the following link to your Azure Active Directory admin to grant consent to
							CodeStream.
						</p>
						<p>
							<Link href={azureUrl}>{azureUrl}</Link>
						</p>
					</div>
					<br />
					<div className="outline-box">
						<h3 style={{ textAlign: "left" }}>Then Sign Up!</h3>
						<p>Once the admin has granted consent you can proceed with the signup.</p>
						<div id="controls">
							<Button className="row-button" onClick={onClickSignUp}>
								<Icon name="msteams" />
								<div className="copy">Sign Up with Microsoft Teams</div>
								<Icon name="chevron-right" />
							</Button>
						</div>
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
}
