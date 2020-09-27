import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Row } from "./CrossPostIssueControls/IssueDropdown";
import { PRHeadshot } from "../src/components/Headshot";
import Tooltip from "./Tooltip";
import { HostApi } from "../webview-api";
import {
	GetMyPullRequestsResponse,
	ThirdPartyProviderConfig,
	UpdateTeamSettingsRequestType
} from "@codestream/protocols/agent";
import { Button } from "../src/components/Button";
import { getMyPullRequests } from "../store/providerPullRequests/actions";
import Tag from "./Tag";
import { Modal } from "./Modal";
import { Dialog, ButtonRow } from "../src/components/Dialog";
import { Link } from "./Link";
import { Checkbox } from "../src/components/Checkbox";
import { PullRequestTooltip } from "./OpenPullRequests";
import styled from "styled-components";
import { PullRequestQuery } from "../protocols/agent/api.protocol.models";
import { closeModal } from "./actions";
import { CodeStreamState } from "../store";
import { isFeatureEnabled } from "../store/apiVersioning/reducer";
import { Radio, RadioGroup } from "../src/components/RadioGroup";

const Form = styled.form`
	h3 {
		margin: 0;
	}
`;

const PreConfigure = styled.div`
	padding-left: 30px;
`;

interface Props {
	onClose: Function;
}

export function TeamSetup(props: Props) {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const team = state.teams[state.context.currentTeamId];
		const user = state.users[state.session.userId!];

		return {
			currentTeamId: state.context.currentTeamId,
			serverUrl: state.configs.serverUrl,
			company: state.companies[team.companyId] || {},
			team,
			currentUserId: state.session.userId,
			pluginVersion: state.pluginVersion,
			xraySetting: team.settings ? team.settings.xray : "",
			multipleReviewersApprove: isFeatureEnabled(state, "multipleReviewersApprove")
		};
	});
	const { team, currentUserId, xraySetting } = derivedState;

	const [nameField, setNameField] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [recommended, setRecommended] = useState(true);
	const [configure, setConfigure] = useState(true);

	const save = () => {};

	const changeXray = async value => {
		await HostApi.instance.send(UpdateTeamSettingsRequestType, {
			teamId: derivedState.team.id,
			settings: { xray: value }
		});
	};

	const repoName = "your repo"; //FIXME
	return (
		<Dialog title="Team Settings" onClose={() => dispatch(closeModal())}>
			<Form className="standard-form">
				<fieldset className="form-body">
					<div id="controls">
						<h3>Live View</h3>
						<p className="explainer">
							Share information about local coding changes with your teammates.{" "}
							<Link href="https://docs.codestream.com/userguide/features/team-live-view/">
								More info
							</Link>
						</p>
						<RadioGroup
							name="live-view"
							selectedValue={xraySetting}
							onChange={value => changeXray(value)}
							loading={isLoading}
						>
							<Radio value="on">Always On</Radio>
							<Radio value="off">Always Off</Radio>
							<Radio value="user">User Selectable</Radio>
						</RadioGroup>
						<div style={{ margin: "20px 0" }}>
							<Checkbox
								name="recommend"
								checked={recommended}
								onChange={() => setRecommended(!recommended)}
							>
								Add CodeStream to VS Code Recommended Extensions
							</Checkbox>
							<div style={{ height: "20px" }} />
							<h3>Pre-Configure for Teammates</h3>
							<p className="explainer">
								Configure CodeStream to make joining easier for your teammates.{" "}
								<Link href="https://docs.codestream.com/userguide/features/team-live-view/">
									More info
								</Link>
							</p>
							<Checkbox
								name="configure"
								checked={configure}
								onChange={() => setConfigure(!configure)}
							>
								Pre-configure CodeStream for users of {repoName}
							</Checkbox>
							{configure && (
								<PreConfigure>
									<Checkbox
										name="configure"
										checked={configure}
										onChange={() => setConfigure(!configure)}
									>
										Add people who access this repo to <b>{team.name}</b>
									</Checkbox>
									<Checkbox
										name="messaging"
										checked={configure}
										onChange={() => setConfigure(!configure)}
									>
										Select Code Host:
									</Checkbox>
									<Checkbox
										name="messaging"
										checked={configure}
										onChange={() => setConfigure(!configure)}
									>
										Select Messaging Service:
									</Checkbox>
									<Checkbox
										name="messaging"
										checked={configure}
										onChange={() => setConfigure(!configure)}
									>
										Select Issue tracker(s):
									</Checkbox>
								</PreConfigure>
							)}
						</div>
					</div>
					<ButtonRow>
						<Button variant="secondary" onClick={() => {}}>
							Cancel
						</Button>
						<Button onClick={save}>Save Team Settings</Button>
					</ButtonRow>
				</fieldset>
			</Form>
		</Dialog>
	);
}
