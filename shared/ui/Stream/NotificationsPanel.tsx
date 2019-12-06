import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import CancelButton from "./CancelButton";
import styled from "styled-components";
import { CodeStreamState } from "../store";
import { RadioGroup, Radio } from "../src/components/RadioGroup";
import { isInVscode } from "../utils";
import { setUserPreference } from "./actions";
import { HostApi } from "../webview-api";

export const NotificationsPanel = props => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		return { notificationPreference: state.preferences.notifications || "involveMe" };
	});
	const [loading, setLoading] = useState(false);

	const handleChange = async (value: string) => {
		setLoading(true);
		HostApi.instance.track("Notification Preference Changed", { Value: value });
		await dispatch(setUserPreference(["notifications"], value));
		setLoading(false);
	};

	return (
		<div className="panel configure-provider-panel">
			<form className="standard-form vscroll">
				<div className="panel-header">
					<CancelButton onClick={props.closePanel} />
					<span className="panel-title">Notification Settings</span>
				</div>
				<fieldset className="form-body">
					<p className="explainer">
						{isInVscode()
							? "Follow codemarks to receive desktop and email notifications."
							: "Follow codemarks to receive email notifications."}
					</p>
					<div id="controls">
						<RadioGroup
							name="preference"
							selectedValue={derivedState.notificationPreference}
							onChange={handleChange}
							loading={loading}
						>
							<Radio value="all">Automatically follow all new codemarks</Radio>
							<Radio value="involveMe">
								Follow codemarks I have created, I have been mentioned in, or I have replied to
							</Radio>
							<Radio value="off">Don't automatically follow any codemarks</Radio>
						</RadioGroup>
						<p>&nbsp;</p>

						<p>
							<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Guide-to-CodeStream-Notifications">
								Learn more about CodeStream Notifications
							</a>
						</p>
					</div>
				</fieldset>
			</form>
		</div>
	);
};
