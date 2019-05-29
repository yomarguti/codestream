import React, { useCallback, useState } from "react";
import cx from "classnames";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import Button from "../Stream/Button";
import { Link } from "../Stream/Link";
import {
	goToCSOrSlack,
	goToJoinTeam,
	goToNewUserEntry,
	goToEmailConfirmation,
	goToTeamCreation
} from "../store/context/actions";
import { TextInput } from "./TextInput";
import { DispatchProp } from "../store/common";
import { LoginResult } from "@codestream/protocols/api";
import { SignupType } from "../store/actions";
import { RegisterUserRequestType } from "@codestream/protocols/agent";
import { HostApi } from "../webview-api";
import { completeSignup } from "../store/session/actions";
import { logError } from "../logger";

const isPasswordValid = (password: string) => password.length >= 6;
const isEmailValid = (email: string) => {
	const emailRegex = new RegExp(
		"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
	);
	return email !== "" && emailRegex.test(email);
};
const isUsernameValid = (username: string) => new RegExp("^[-a-zA-Z0-9_.]{1,21}$").test(username);

const isNotEmpty = s => s.length > 0;

interface InheritedProps {
	email?: string;
	teamName?: string;
	teamId?: string;
	inviteCode?: string;
	type?: SignupType;
}

interface Props extends InheritedProps, DispatchProp {}

export const Signup = (connect() as any)((props: Props) => {
	const [email, setEmail] = useState(props.email || "");
	const [emailValidity, setEmailValidity] = useState(true);
	const [username, setUsername] = useState("");
	const [usernameValidity, setUsernameValidity] = useState(true);
	const [password, setPassword] = useState("");
	const [passwordValidity, setPasswordValidity] = useState(true);
	const [fullName, setFullName] = useState("");
	const [fullNameValidity, setFullNameValidity] = useState(true);
	const [companyName, setCompanyName] = useState("");
	const [companyNameValidity, setCompanyNameValidity] = useState(true);
	const [isLoading, setIsLoading] = useState(false);
	const [unexpectedError, setUnexpectedError] = useState(false);
	const [inviteConflict, setInviteConflict] = useState(false);

	const wasInvited = props.inviteCode !== undefined;

	const onValidityChanged = useCallback((field: string, validity: boolean) => {
		switch (field) {
			case "email": {
				setEmailValidity(validity);
				break;
			}
			case "username":
				setUsernameValidity(validity);
				break;
			case "password":
				setPasswordValidity(validity);
				break;
			case "fullName":
				setFullNameValidity(validity);
				break;
			case "companyName":
				setCompanyNameValidity(validity);
				break;
			default: {
			}
		}
	}, []);

	const onSubmit = async (event: React.SyntheticEvent) => {
		setInviteConflict(false);
		setUnexpectedError(false);
		event.preventDefault();
		if (
			email === "" ||
			!emailValidity ||
			!usernameValidity ||
			password === "" ||
			!passwordValidity ||
			fullName === "" ||
			!fullNameValidity ||
			(!wasInvited && (companyName === "" || !companyNameValidity))
		)
			return;
		setIsLoading(true);
		try {
			const attributes = {
				email,
				username,
				password,
				fullName,
				inviteCode: props.inviteCode,
				companyName: wasInvited ? undefined : companyName
			};
			const { status, token } = await HostApi.instance.send(RegisterUserRequestType, attributes);

			const sendTelemetry = () => {
				HostApi.instance.track("Account Created", {
					"Changed Invite Email?": email !== props.email
				});
			};

			switch (status) {
				case LoginResult.Success: {
					sendTelemetry();
					props.dispatch(
						goToEmailConfirmation({
							email: attributes.email,
							teamId: props.teamId,
							registrationParams: attributes
						})
					);
					break;
				}
				case LoginResult.NotOnTeam: {
					sendTelemetry();
					props.dispatch(goToTeamCreation({ token, email: attributes.email }));
					break;
				}
				case LoginResult.AlreadyConfirmed: {
					// because user was invited
					sendTelemetry();
					props.dispatch(
						completeSignup(attributes.email, token!, props.teamId!, {
							createdTeam: false
						})
					);
					break;
				}
				case LoginResult.InviteConflict: {
					setInviteConflict(true);
					break;
				}
				default:
					throw status;
			}
		} catch (error) {
			logError(`Unexpected error during registration request: ${error}`, {
				email,
				inviteCode: props.inviteCode
			});
			setUnexpectedError(true);
		}
		setIsLoading(false);
	};

	const onClickGoBack = useCallback(
		(event: React.SyntheticEvent) => {
			event.preventDefault();
			switch (props.type) {
				case SignupType.CreateTeam: {
					return props.dispatch(goToCSOrSlack());
				}
				case SignupType.JoinTeam: {
					return props.dispatch(goToJoinTeam());
				}
				default:
					return props.dispatch(goToNewUserEntry());
			}
		},
		[props.type]
	);

	return (
		<div className="onboarding-page">
			<h2>Create an Account</h2>
			{wasInvited && (
				<React.Fragment>
					<br />
					<p>
						Create an account to join the <strong>{props.teamName}</strong> team.
					</p>
				</React.Fragment>
			)}
			<form className="standard-form" onSubmit={onSubmit}>
				<fieldset className="form-body">
					<div id="controls">
						{unexpectedError && (
							<div className="error-message form-error">
								<FormattedMessage
									id="error.unexpected"
									defaultMessage="Something went wrong! Please try again, or "
								/>
								<FormattedMessage id="contactSupport" defaultMessage="contact support">
									{text => <Link href="https://help.codestream.com">{text}</Link>}
								</FormattedMessage>
								.
							</div>
						)}
						{inviteConflict && (
							<div className="error-message form-error">
								Invitation conflict.{" "}
								<FormattedMessage id="contactSupport" defaultMessage="Contact support">
									{text => <Link href="mailto:support@codestream.com">{text}</Link>}
								</FormattedMessage>
								.
							</div>
						)}
						<div className="control-group">
							<label>
								<FormattedMessage id="signUp.email.label" />
							</label>
							<TextInput
								name="email"
								value={email}
								onChange={setEmail}
								onValidityChanged={onValidityChanged}
								validate={isEmailValid}
								required
							/>
							{!emailValidity && (
								<small className="explainer error-message">
									<FormattedMessage id="signUp.email.invalid" />
								</small>
							)}
						</div>
						<div className="control-group">
							<label>
								<FormattedMessage id="signUp.password.label" />
							</label>
							<TextInput
								type="password"
								name="password"
								value={password}
								onChange={setPassword}
								validate={isPasswordValid}
								onValidityChanged={onValidityChanged}
								required
							/>
							<small className={cx("explainer", { "error-message": !passwordValidity })}>
								<FormattedMessage id="signUp.password.help" />
							</small>
						</div>
						<div className="control-group">
							<label>
								<FormattedMessage id="signUp.username.label" />
							</label>
							<TextInput
								name="username"
								value={username}
								onChange={setUsername}
								onValidityChanged={onValidityChanged}
								validate={isUsernameValid}
							/>
							<small className={cx("explainer", { "error-message": !usernameValidity })}>
								<FormattedMessage id="signUp.username.help" />
							</small>
						</div>
						<div className="control-group">
							<label>
								<FormattedMessage id="signUp.fullName.label" />
							</label>
							<TextInput
								name="fullName"
								value={fullName}
								onChange={setFullName}
								required
								validate={isNotEmpty}
								onValidityChanged={onValidityChanged}
							/>
							{!fullNameValidity && <small className="explainer error-message">Required</small>}
						</div>
						{!wasInvited && (
							<div className="control-group">
								<label>
									<FormattedMessage id="signUp.companyName.label" />
								</label>
								<TextInput
									name="companyName"
									value={companyName}
									onChange={setCompanyName}
									required
									validate={isNotEmpty}
									onValidityChanged={onValidityChanged}
								/>
								{!companyNameValidity && (
									<small className="explainer error-message">Required</small>
								)}
							</div>
						)}
						<div className="button-group">
							<Button className="control-button" type="submit" loading={isLoading}>
								<FormattedMessage id="signUp.submitButton" />
							</Button>
						</div>
						<br />
						<small className="fine-print">
							<FormattedMessage id="signUp.legal.start" />{" "}
							<FormattedMessage id="signUp.legal.termsOfService">
								{text => <Link href="https://codestream.com/terms">{text}</Link>}
							</FormattedMessage>{" "}
							<FormattedMessage id="and" />{" "}
							<FormattedMessage id="signUp.legal.privacyPolicy">
								{text => <Link href="https://codestream.com/privacy">{text}</Link>}
							</FormattedMessage>
						</small>
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
});
