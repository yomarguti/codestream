import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import CancelButton from "./CancelButton";
import { CodeStreamState } from "../store";
import { HostApi } from "../webview-api";
import { Button } from "../src/components/Button";
import styled from "styled-components";

const ButtonRow = styled.div`
	text-align: center;
	margin-top: 20px;
	button {
		width: 18em;
	}
`;
const Root = styled.div`
	input[type="text"] {
		margin-bottom: 20px;
	}
`;

export const ChangePasswordPanel = props => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		return {};
	});
	const [loading, setLoading] = useState(false);
	const [oldPassword, setOldPassword] = useState("");
	const [newPassword1, setNewPassword1] = useState("");
	const [newPassword2, setNewPassword2] = useState("");

	const savePassword = async () => {
		setLoading(true);
		HostApi.instance.track("Password Changed", {});
		// @ts-ignore
		// const result = await dispatch(setUserPassword(oldPassword, newPassword2));
		setLoading(false);
	};

	return (
		<Root className="full-height-panel">
			<form className="standard-form vscroll">
				<div className="panel-header">
					<CancelButton onClick={props.closePanel} />
					<span className="panel-title">Change Password</span>
				</div>
				<fieldset className="form-body" style={{ width: "18em" }}>
					<div id="controls">
						<input
							name="old-password"
							value={oldPassword}
							className="input-text control"
							autoFocus
							type="text"
							onChange={e => setOldPassword(e.target.value)}
							placeholder="Enter your old password"
						/>
						<input
							name="new-password1"
							value={newPassword1}
							className="input-text control"
							type="text"
							onChange={e => setNewPassword1(e.target.value)}
							placeholder="Enter your new password"
						/>
						<input
							name="new-password2"
							value={newPassword2}
							className="input-text control"
							type="text"
							onChange={e => setNewPassword2(e.target.value)}
							placeholder="Retype your new password"
						/>
						<ButtonRow>
							<Button onClick={savePassword} isLoading={loading}>
								Save Password
							</Button>
						</ButtonRow>
					</div>
				</fieldset>
			</form>
		</Root>
	);
};
