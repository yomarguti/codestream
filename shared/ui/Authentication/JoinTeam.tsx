import React, { useState, useCallback } from "react";
import Icon from "../Stream/Icon";
import Button from "../Stream/Button";
import { connect } from "react-redux";
import { goToNewUserEntry, goToSignup } from "../store/context/actions";
import { Link } from "../Stream/Link";
import { TextInput } from "./TextInput";
import { startSSOSignin, SignupType } from "../store/actions";
import { HostApi } from "..";
import { DispatchProp } from "../store/common";
import { GetInviteInfoRequestType } from "@codestream/protocols/agent";
import { LoginResult } from "@codestream/protocols/api";
import { FormattedMessage } from "react-intl";

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
				HostApi.instance.track("Join Path Selected", { "Path Type": "CodeStream" });
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
												error here
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
					<br />
					<div className="outline-box">
						<h3>Do you use Slack or Microsoft Teams?</h3>
						<p>
							Use this option if your organization's CodeStream team is connected to a Slack
							workspace or a Microsoft Teams organization.
						</p>
						<div id="controls">
							<Button
								className="row-button"
								onClick={e => {
									e.preventDefault();
									HostApi.instance.track("Join Path Selected", { "Path Type": "Slack" });
									props.dispatch(startSSOSignin("slack", { type: SignupType.JoinTeam }));
								}}
							>
								<Icon name="slack" />
								<div className="copy">Sign Up with Slack</div>
								<Icon name="chevron-right" />
							</Button>
						</div>
						<div id="controls">
							<Button
								className="row-button"
								onClick={e => {
									e.preventDefault();
									HostApi.instance.track("Join Path Selected", { "Path Type": "MSTeams" });
									props.dispatch(startSSOSignin("msteams", { type: SignupType.JoinTeam }));
								}}
							>
								<Icon name="msteams" />
								<div className="copy">Sign Up with Microsoft Teams</div>
								<Icon name="chevron-right" />
							</Button>
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
