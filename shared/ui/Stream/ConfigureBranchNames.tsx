import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import CancelButton from "./CancelButton";
import { CodeStreamState } from "../store";
import { HostApi } from "../webview-api";
import Icon from "./Icon";
import { Checkbox } from "../src/components/Checkbox";
import styled from "styled-components";
import { Button } from "../src/components/Button";
import { setUserStatus } from "./actions";
import { closePanel } from "../store/context/actions";
import { CSMe } from "@codestream/protocols/api";
import { emojiPlain } from "./Markdowner";
import { InlineMenu } from "../src/components/controls/InlineMenu";
import EmojiPicker from "./EmojiPicker";
import { useDidMount } from "../utilities/hooks";
import {
	GetBranchesRequestType,
	CreateBranchRequestType,
	UpdateTeamSettingsRequestType
} from "@codestream/protocols/agent";
import Menu from "./Menu";
import { CrossPostIssueContext } from "./CodemarkForm";
import IssueDropdown from "./CrossPostIssueControls/IssueDropdown";
import { CSText } from "../src/components/CSText";
import { ButtonRow } from "./ChangeUsernamePanel";
const emojiData = require("../node_modules/markdown-it-emoji-mart/lib/data/full.json");

const Root = styled.div`
	h3 {
		margin: 10px 0 5px 0;
	}
`;
export const ConfigureBranchNames = (props: { onClose: Function }) => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const teamId = state.context.currentTeamId;
		const team = state.teams[teamId];
		const settings = team.settings || {};

		return {
			teamId,
			branchMaxLength: settings.branchMaxLength,
			branchTicketTemplate: settings.branchTicketTemplate,
			branchDescriptionTemplate: settings.branchDescriptionTemplate
		};
	});

	const [branchMaxLength, setBranchMaxLength] = useState(derivedState.branchMaxLength || 40);
	const [branchTicketTemplate, setBranchTicketTemplate] = useState(
		derivedState.branchTicketTemplate
	);
	const [branchDescriptionTemplate, setBranchDescriptionTemplate] = useState(
		derivedState.branchDescriptionTemplate
	);

	const save = async () => {
		await HostApi.instance.send(UpdateTeamSettingsRequestType, {
			teamId: derivedState.teamId,
			// we need to replace . with * to allow for the creation of deeply-nested
			// team settings, since that's how they're stored in mongo
			settings: { branchMaxLength, branchTicketTemplate, branchDescriptionTemplate }
		});
		props.onClose();
	};

	return (
		<Root>
			<div className="full-height-panel">
				<form className="standard-form vscroll">
					<div className="panel-header">
						<CancelButton onClick={props.onClose} placement="left" />
					</div>
					<fieldset className="form-body" style={{ padding: "10px" }}>
						<div id="controls">
							<h3>When creating a branch from a ticket:</h3>
							<input
								name="branchTicketTemplate"
								value={branchTicketTemplate}
								className="input-text control"
								autoFocus
								type="text"
								onChange={e => setBranchTicketTemplate(e.target.value)}
								placeholder="Example: feature/jira-{id}"
							/>
						</div>
						<br />
						<div id="controls">
							<h3>When creating a branch from a description:</h3>
							<input
								name="branchDescriptionTemplate"
								value={branchDescriptionTemplate}
								className="input-text control"
								type="text"
								onChange={e => setBranchDescriptionTemplate(e.target.value)}
								placeholder="Example: feature/{username}/{desription}"
							/>
						</div>
						<div style={{ margin: "30px 0 30px 0" }}>
							<h3>Available tokens:</h3>
							<span className="monospace">{"{username} {id} {description} {team} {date}"}</span>
						</div>
						<div id="controls">
							<h3>Maximum Branch Length:</h3>
							<input
								name="branchMaxLength"
								value={branchMaxLength}
								className="input-text control"
								type="text"
								onChange={e => setBranchMaxLength(e.target.value.replace(/\D/g, ""))}
							/>
						</div>
						<div style={{ height: "20px" }} />
						<ButtonRow>
							<Button onClick={save}>Save</Button>
						</ButtonRow>
					</fieldset>
				</form>
			</div>
		</Root>
	);
};
