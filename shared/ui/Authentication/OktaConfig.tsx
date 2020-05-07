import React, { useState, useCallback } from "react";
import Button from "../Stream/Button";
import { TextInput } from "./TextInput";
import { connect } from "react-redux";
import { Link } from "../Stream/Link";
import { goToLogin, goToSignup } from "../store/context/actions";
import { DispatchProp } from "../store/common";
import { HostApi } from "../webview-api";
import { FormattedMessage } from "react-intl";
import { startSSOSignin, SignupType } from "./actions";

const isOrgValid = (org: string) => org.length > 0;

interface ConnectedProps {
	fromSignup?: boolean;
	inviteCode?: string;
}

export const OktaConfig = (connect() as any)((props: ConnectedProps & DispatchProp) => {
	const [orgName, setOrgName] = useState("");
	const [orgValidity, setOrgValidity] = useState(true);
	const [isLoading, setIsLoading] = useState(false);

	const onValidityChanged = useCallback(
		(_: string, validity: boolean) => setOrgValidity(validity),
		[]
	);

	const onCancel = useCallback((event: React.SyntheticEvent) => {
		event.preventDefault();
		console.warn("CANCELLED!");
		if (props.fromSignup) {
			props.dispatch(goToSignup());
		} else {
			props.dispatch(goToLogin());
		}
	}, []);

	const onSubmit = async (event: React.FormEvent) => {
		console.warn("SUBMITTING!");
		event.preventDefault();
		if (orgName !== "" && orgValidity) {
			setIsLoading(true);
			try {
				HostApi.instance.track("Provider Auth Selected", {
					Provider: "Okta"
				});
				const info = props.inviteCode
					? { type: SignupType.JoinTeam, orgId: orgName, inviteCode: props.inviteCode }
					: { type: SignupType.CreateTeam, orgId: orgName };
				console.warn("STARTING SSO SIGNIN", info);
				props.dispatch(startSSOSignin("okta", info));
			} catch (error) {
				console.warn("ERROR", error);
				// TODO: communicate error
				if (props.fromSignup) {
					props.dispatch(goToSignup());
				} else {
					props.dispatch(goToLogin());
				}
			}
		}
	};

	return (
		<div className="onboarding-page">
			<form className="standard-form" onSubmit={onSubmit}>
				<fieldset className="form-body">
					<div className="outline-box">
						<h3>Organization</h3>
						<p>
							Enter the name of your Okta organization. For example, if you access Okta at https://
							<strong>myorg</strong>.okta.com, you would supply "<strong>myorg</strong>" here.
						</p>
						<div id="controls">
							<div className="control-group">
								<div style={{ height: "20px" }} />
								<TextInput
									name="team"
									placeholder="myorg"
									value={orgName}
									onChange={setOrgName}
									validate={isOrgValid}
									onValidityChanged={onValidityChanged}
									required
								/>
								{!orgValidity && <small className="explainer error-message">Required</small>}
							</div>
							<div className="button-group">
								<Button className="control-button" type="submit" loading={isLoading}>
									<FormattedMessage id="oktaConfig.submitButton" />
								</Button>
							</div>
						</div>
					</div>
					<div id="controls">
						<div className="footer">
							<Link onClick={onCancel}>Cancel</Link>
						</div>
					</div>
				</fieldset>
			</form>
		</div>
	);
});
