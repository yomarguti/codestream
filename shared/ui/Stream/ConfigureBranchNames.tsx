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
import { GetBranchesRequestType, CreateBranchRequestType } from "@codestream/protocols/agent";
import Menu from "./Menu";
import { CrossPostIssueContext } from "./CodemarkForm";
import IssueDropdown from "./CrossPostIssueControls/IssueDropdown";
import { CSText } from "../src/components/CSText";
import { ButtonRow } from "./ChangeUsernamePanel";
const emojiData = require("../node_modules/markdown-it-emoji-mart/lib/data/full.json");

const StyledCheckbox = styled(Checkbox)`
	color: var(--text-color-subtle);
`;
export const ConfigureBranchNames = (props: { onClose: Function }) => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		return {
			textEditorUri: state.editorContext.textEditorUri
		};
	});

	const [connectedPattern, setConnectdPattern] = useState("");
	const [disconnectedPattern, setDisconnectdPattern] = useState("");

	const save = () => {};

	return (
		<div className="full-height-panel">
			<form className="standard-form vscroll">
				<div className="panel-header">
					Configure Branch Naming
					<CancelButton onClick={props.onClose} placement="left" />
				</div>
				<fieldset className="form-body" style={{ padding: "10px" }}>
					<div id="controls">
						<label>When creating a branch from a [Trello Card]:</label>
						<input
							name="connectedPattern"
							value={connectedPattern}
							className="input-text control"
							autoFocus={true}
							type="text"
							onChange={e => setConnectdPattern(e.target.value)}
							placeholder="Enter pattern"
						/>
						Available tokens: <span className="monospace">{"{id} {description}"}</span>
						<br />
						Example: <span className="monospace">{"feature/trello-{id}"}</span>
					</div>
					<br />
					<div id="controls">
						<label>When creating a branch from a description:</label>
						<input
							name="disconnectedPattern"
							value={disconnectedPattern}
							className="input-text control"
							type="text"
							onChange={e => setDisconnectdPattern(e.target.value)}
							placeholder="Enter pattern"
						/>
						Example: <span className="monospace">{"feature/dev-{description}"}</span>
					</div>
					<ButtonRow>
						<Button onClick={save}>Save</Button>
					</ButtonRow>
				</fieldset>
			</form>
		</div>
	);
};
