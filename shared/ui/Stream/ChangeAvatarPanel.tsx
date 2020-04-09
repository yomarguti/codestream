import React, { useState, useCallback, useRef } from "react";
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
import { Link } from "./Link";
import { TextInput } from "../Authentication/TextInput";

const Root = styled.div`
	#controls {
		padding-top: 10px;
	}
`;

// profile images can either be blank, in which case we'll fall back to
// gravatar, and then initials if no gravatar, or they can be a URL
const isValidImage = s => s.length === 0 || s.toLocaleLowerCase().startsWith("http");

export const ChangeAvatarPanel = props => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const currentUser = state.users[state.session.userId!] as CSMe;
		return { currentAvatar: currentUser.avatar ? currentUser.avatar.image : "" };
	});
	const [loading, setLoading] = useState(false);
	const [avatar, setAvatar] = useState(derivedState.currentAvatar || "");
	const [avatarValidity, setAvatarValidity] = useState(true);
	const [unexpectedError, setUnexpectedError] = useState(false);

	const onValidityChanged = useCallback((field: string, validity: boolean) => {
		switch (field) {
			case "avatar":
				setAvatarValidity(validity);
				break;
			default: {
			}
		}
	}, []);

	const onSubmit = async (event: React.SyntheticEvent, clear?: boolean) => {
		setUnexpectedError(false);
		event.preventDefault();
		if (!clear) {
			onValidityChanged("avatar", isValidImage(avatar));
			if (!avatarValidity) return;
		}

		setLoading(true);
		const image = clear ? "" : avatar;
		try {
			await HostApi.instance.send(UpdateUserRequestType, { avatar: { image } });
			HostApi.instance.track("Avatar Change Request", {});
			props.closePanel();
		} catch (error) {
			logError(`Unexpected error during change avatar: ${error}`, { image });
			setUnexpectedError(true);
		}
		// @ts-ignore
		setLoading(false);
	};

	return (
		<Root className="full-height-panel onboarding-page" style={{ padding: 0 }}>
			<form className="standard-form vscroll">
				<div className="panel-header">
					<CancelButton onClick={props.closePanel} />
				</div>
				<fieldset className="form-body" style={{ width: "18em" }}>
					<div className="outline-box">
						<h3>Set Profile Photo</h3>
						<p>
							CodeStream can automatically grab your profile photo from{" "}
							<a href="https://gravatar.com">gravatar.com</a>.
						</p>
						<p>Alternatively set it here by using an existing image.</p>

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
								<label>Photo URL</label>
								<TextInput
									name="avatar"
									value={avatar}
									autoFocus
									onChange={setAvatar}
									onValidityChanged={onValidityChanged}
									validate={isValidImage}
								/>
								{!avatarValidity && <small className="explainer error-message">Blank or URL</small>}
								<ButtonRow>
									<Button onClick={onSubmit} isLoading={loading}>
										Save Profile Photo
									</Button>
								</ButtonRow>
								<div
									style={{
										margin: "20px -20px 0 -20px",
										height: "1px",
										background: "var(--base-border-color)"
									}}
								></div>
								<ButtonRow>
									<Button onClick={e => onSubmit(e, true)} isLoading={loading} variant="secondary">
										Use Gravatar
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
