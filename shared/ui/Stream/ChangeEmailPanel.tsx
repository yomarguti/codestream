import React, { useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import CancelButton from "./CancelButton";
import { CodeStreamState } from "../store";
import { HostApi } from "../webview-api";
import { Button } from "../src/components/Button";
import styled from "styled-components";
import { ButtonRow } from "./ChangeUsernamePanel";
import { UpdateUserRequestType } from "../protocols/agent/agent.protocol.users";
import { logError } from "../logger";
import { FormattedMessage } from "react-intl";
import { CSMe } from "@codestream/protocols/api";
import cx from "classnames";
import { Link } from "./Link";
import { TextInput } from "../Authentication/TextInput";
import { isEmailValid } from "../Authentication/Signup";

const Root = styled.div`
	#controls {
		padding-top: 10px;
	}
`;

export const ChangeEmailPanel = props => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const currentUser = state.users[state.session.userId!] as CSMe;
		return { currentEmail: currentUser.email };
	});
	const [loading, setLoading] = useState(false);
	const [email, setEmail] = useState(derivedState.currentEmail);
	const [emailValidity, setEmailValidity] = useState(true);
	const [unexpectedError, setUnexpectedError] = useState(false);
	const [formInvalid, setFormInvalid] = useState(false);

	const onValidityChanged = useCallback((field: string, validity: boolean) => {
		switch (field) {
			case "email":
				setEmailValidity(validity);
				break;
			default: {
			}
		}
	}, []);

	const onSubmit = async (event: React.SyntheticEvent) => {
		setUnexpectedError(false);
		event.preventDefault();
		onValidityChanged("email", isEmailValid(email));
		if (!emailValidity) return;

		setLoading(true);
		try {
			await HostApi.instance.send(UpdateUserRequestType, { email });
			HostApi.instance.track("Email Changed", {});
			props.closePanel();
		} catch (error) {
			logError(`Unexpected error during change email: ${error}`, { email });
			setUnexpectedError(true);
		}
		// @ts-ignore
		setLoading(false);
	};

	return (
		<Root className="full-height-panel">
			<form className="standard-form vscroll">
				<div className="panel-header">
					<CancelButton onClick={props.closePanel} />
				</div>
				<fieldset className="form-body" style={{ width: "18em" }}>
					<div className="outline-box">
						<h3>Change Email</h3>
						<div id="controls">
							<div className="small-spacer" />
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
							<div className="control-group">
								<label>Email</label>
								<TextInput
									name="Email"
									value={email}
									autoFocus
									onChange={setEmail}
									onValidityChanged={onValidityChanged}
									validate={isEmailValid}
								/>
								{!emailValidity && (
									<small className="explainer error-message">
										<FormattedMessage id="signUp.email.invalid" />
									</small>
								)}
								<ButtonRow>
									<Button onClick={onSubmit} isLoading={loading}>
										Save Email
									</Button>
								</ButtonRow>
							</div>
						</div>
					</div>
				</fieldset>
			</form>
		</Root>
	);
};
