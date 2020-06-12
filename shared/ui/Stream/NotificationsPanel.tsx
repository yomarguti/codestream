import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import CancelButton from "./CancelButton";
import { CodeStreamState } from "../store";
import { isFeatureEnabled } from "../store/apiVersioning/reducer";
import { RadioGroup, Radio } from "../src/components/RadioGroup";
import { setUserPreference } from "./actions";
import { HostApi } from "../webview-api";
import { CSNotificationDeliveryPreference } from "@codestream/protocols/api";
import Icon from "./Icon";

export const NotificationsPanel = props => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const hasDesktopNotifications = state.ide.name === "VSC" || state.ide.name === "JETBRAINS";
		const notificationDeliverySupported = isFeatureEnabled(state, "notificationDeliveryPreference");
		const emailSupported = isFeatureEnabled(state, "emailSupport");
		return {
			notificationPreference: state.preferences.notifications || "involveMe",
			notificationDeliveryPreference: state.preferences.notificationDelivery || "both",
			hasDesktopNotifications,
			notificationDeliverySupported,
			emailSupported
		};
	});
	const [loading, setLoading] = useState(false);
	const [loadingDelivery, setLoadingDelivery] = useState(false);

	const handleChange = async (value: string) => {
		setLoading(true);
		HostApi.instance.track("Notification Preference Changed", { Value: value });
		// @ts-ignore
		await dispatch(setUserPreference(["notifications"], value));
		setLoading(false);
	};

	const handleChangeDelivery = async (value: string) => {
		setLoadingDelivery(true);
		HostApi.instance.track("Notification Delivery Preference Changed", { Value: value });
		// @ts-ignore
		await dispatch(setUserPreference(["notificationDelivery"], value));
		setLoadingDelivery(false);
	};

	return (
		<div className="panel configure-provider-panel">
			<form className="standard-form vscroll">
				<div className="panel-header">
					<CancelButton onClick={props.closePanel} />
					<span className="panel-title">Notification Settings</span>
				</div>
				<fieldset className="form-body">
					{!derivedState.emailSupported && (
						<p
							className="color-warning"
							style={{ display: "flex", padding: "10px 0", whiteSpace: "normal" }}
						>
							<Icon name="alert" />
							<div style={{ paddingLeft: "10px" }}>
								Ask your admin to set up outbound email for your on-prem instance of CodeStream.
							</div>
						</p>
					)}
					<p className="explainer">
						{derivedState.hasDesktopNotifications
							? "Follow codemarks and reviews to receive desktop and email notifications."
							: "Follow codemarks and reviews to receive email notifications."}
					</p>
					<div id="controls">
						<RadioGroup
							name="preference"
							selectedValue={derivedState.notificationPreference}
							onChange={handleChange}
							loading={loading}
							disabled={!derivedState.emailSupported}
						>
							<Radio value="all">Automatically follow all new codemarks and reviews</Radio>
							<Radio value="involveMe">
								Follow codemarks and reviews I have created, I have been mentioned in, or I have
								replied to
							</Radio>
							<Radio value="off">Don't automatically follow any codemarks or reviews</Radio>
						</RadioGroup>
						{derivedState.hasDesktopNotifications && derivedState.notificationDeliverySupported && (
							<div style={{ marginTop: "20px" }}>
								<p className="explainer">Deliver notifications via:</p>
								<RadioGroup
									name="delivery"
									selectedValue={derivedState.notificationDeliveryPreference}
									onChange={handleChangeDelivery}
									loading={loadingDelivery}
									disabled={!derivedState.emailSupported}
								>
									<Radio value={CSNotificationDeliveryPreference.All}>Email &amp; Desktop</Radio>
									<Radio value={CSNotificationDeliveryPreference.EmailOnly}>Email only</Radio>
									<Radio value={CSNotificationDeliveryPreference.ToastOnly}>Desktop only</Radio>
									<Radio value={CSNotificationDeliveryPreference.Off}>None</Radio>
								</RadioGroup>
							</div>
						)}
						<p>&nbsp;</p>

						<p>
							<a href="https://docs.codestream.com/userguide/features/notifications/">
								Learn more about CodeStream Notifications
							</a>
						</p>
					</div>
				</fieldset>
			</form>
		</div>
	);
};
