import React, { useState, useCallback } from "react";
import Button from "../Stream/Button";
import { connect } from "react-redux";
import { goToNewUserEntry, goToSignup } from "../store/context/actions";
import { Link } from "../Stream/Link";
import { TextInput } from "./TextInput";
import { HostApi } from "..";
import { DispatchProp } from "../store/common";
import { GetInviteInfoRequestType } from "@codestream/protocols/agent";
import { LoginResult } from "@codestream/protocols/api";
import { FormattedMessage } from "react-intl";
import { SignupType } from "./actions";

const errorToMessageId = {
	[LoginResult.InvalidToken]: "confirmation.invalid",
	[LoginResult.ExpiredToken]: "confirmation.expired",
	[LoginResult.Unknown]: "unexpectedError"
};

export const JoinTeam = (connect(undefined) as any)((props: DispatchProp) => {
	const [inviteCode, setInviteCode] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<LoginResult | undefined>(undefined);

	const onChange = useCallback(code => {
		setError(undefined);
		setInviteCode(code);
	}, []);

	const onClickJoin = useCallback(
		async event => {
			event.preventDefault();
			const code = inviteCode.trim();
			if (code === "") return;
			setIsLoading(true);

			const { status, info } = await HostApi.instance.send(GetInviteInfoRequestType, {
				code
			});

			if (status === LoginResult.Success) {
				HostApi.instance.track("Invitation Code Submitted");
				props.dispatch(goToSignup({ ...info, inviteCode: code, type: SignupType.JoinTeam }));
			} else {
				setIsLoading(false);
				setError(status);
			}
		},
		[inviteCode]
	);

	return (
		<div className="onboarding-page">
			<form className="standard-form" onSubmit={onClickJoin}>
				<fieldset className="form-body">
					<div className="outline-box">
						<h3>Were you invited to CodeStream?</h3>
						<div id="controls">
							<div className="control-group">
								<div className="two-col" style={{ display: "flex", marginTop: "15px" }}>
									<div style={{ width: "100%" }}>
										<TextInput
											value={inviteCode}
											onChange={onChange}
											placeholder="Enter invitation code"
										/>
										{error && (
											<small className="explainer error-message ">
												<FormattedMessage
													id={errorToMessageId[error]}
													defaultMessage="There is an error with that code"
												/>
											</small>
										)}
									</div>
									<Button
										className="control-button"
										type="button"
										onClick={onClickJoin}
										loading={isLoading}
										style={{ width: "10em", marginLeft: "20px" }}
									>
										<b style={{ fontSize: "15px" }}>Join</b>
									</Button>
								</div>
							</div>
						</div>
					</div>
					<div id="controls">
						<div className="footer">
							<Link
								onClick={e => {
									e.preventDefault();
									props.dispatch(goToNewUserEntry());
								}}
							>
								<p>{"< Back"}</p>
							</Link>
						</div>
					</div>
				</fieldset>
			</form>
		</div>
	);
});
