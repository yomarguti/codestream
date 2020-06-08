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
import { ConfigureBranchNames } from "./ConfigureBranchNames";
const emojiData = require("../node_modules/markdown-it-emoji-mart/lib/data/full.json");

const StyledCheckbox = styled(Checkbox)`
	color: var(--text-color-subtle);
`;

const StatusInput = styled.div`
	position: relative;
	margin-bottom: 20px;
	.icon-selector,
	.dropdown-button {
		position: absolute;
		left: 1px;
		top: 1px;
		border-right: 1px solid var(--base-border-color);
		font-size: 18px;
		line-height: 20px;
		display: flex;
		width: 34px;
		height: calc(100% - 2px);
		align-items: center;
		justify-content: center;
		cursor: pointer;
		&:hover {
			background: var(--app-background-color);
			color: var(--text-color-highlight);
		}
		&.selected {
			background: var(--button-background-color);
			color: var(--button-foreground-color);
		}
		.octicon-git-branch {
			margin: 2px 2px -2px -2px;
		}
	}
	.clear {
		position: absolute;
		right: 2px;
		top: 1px;
		padding: 8px 10px;
	}
	.dropdown-button {
		left: auto;
		right: 1px;
		align-items: center;
		justify-content: center;
		border-left: 1px solid var(--base-border-color);
		border-right: none;
		.icon {
			margin: 4px 0 0 -2px;
			&.spin {
				margin: -2px 0 0 -1px;
			}
		}
	}
	input#status-input {
		border: 1px solid var(--base-border-color);
		font-size: 14px !important;
		padding: 8px 40px 8px 42px !important;
		&::placeholder {
			font-size: 14px !important;
		}
	}
`;

const ButtonRow = styled.div`
	text-align: center;
	margin-top: 20px;
	button {
		width: 18em;
	}
`;

const Examples = styled.div`
	padding: 5px 0 20px 0;
	div {
		cursor: pointer;
		padding: 3px 8px;
		font-weight: bold;
		.time {
			font-weight: normal;
			opacity: 0.5;
		}
		.icon {
			display: inline-block;
			width: 20px;
		}
		.emoji {
			vertical-align: -2px;
			padding-right: 3px;
			font-size: 20px;
		}
		&:hover {
			background: var(--base-background-color);
			color: var(--text-color-highlight);
		}
	}
`;

const MonoMenu = styled(InlineMenu)`
	font-family: Menlo, Consolas, "DejaVu Sans Mono", monospace;
`;

const EMPTY_STATUS = {
	label: "",
	icon: ":desktop_computer:",
	expires: 0
};

export const StatusPanel = (props: { closePanel: Function }) => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const currentUser = state.users[state.session.userId!] as CSMe;
		let status =
			currentUser.status && "label" in currentUser.status ? currentUser.status : EMPTY_STATUS;
		const now = new Date().getTime();
		if (status.expires && status.expires < now) status = EMPTY_STATUS;

		return {
			status,
			textEditorUri: state.editorContext.textEditorUri,
			notificationPreference: state.preferences.notifications || "involveMe"
		};
	});

	const { status } = derivedState;
	const [loading, setLoading] = useState(false);
	const [label, setLabel] = useState(status.label || "");
	const [icon, setIcon] = useState(status.icon || ":desktop_computer:");
	const [emojiMenuOpen, setEmojiMenuOpen] = useState(false);
	const [emojiMenuTarget, setEmojiMenuTarget] = useState(null as any);
	const [moveIssue, setMoveIssue] = useState(true);
	const [createBranch, setCreateBranch] = useState(true);
	const [branch, setBranch] = useState("");
	const [newBranch, setNewBranch] = useState("");
	const [currentBranch, setCurrentBranch] = useState("");
	const [editingBranch, setEditingBranch] = useState(false);
	const [branches, setBranches] = useState([] as string[]);
	const [branchTouched, setBranchTouched] = useState(false);
	const [configureBranchNames, setConfigureBranchNames] = useState(false);

	const showMoveIssueCheckbox = React.useMemo(() => {
		return label && label.startsWith("http");
	}, [label]);
	const showCreateBranchCheckbox = React.useMemo(() => {
		return label; // && label.startsWith("http");
	}, [label]);

	const setTheLabel = (value: string, newBranch?: string) => {
		setLabel(value);

		if (newBranch) {
			setNewBranch(newBranch);
			if (!branchTouched) setBranch(newBranch);
		}
	};

	const makeBranchName = value => "feature/" + value.replace(/[\s\W]+/g, "-").toLowerCase();

	const getBranches = async () => {
		if (!derivedState.textEditorUri) return;
		const branchInfo = await HostApi.instance.send(GetBranchesRequestType, {
			uri: derivedState.textEditorUri
		});
		if (!branchInfo.scm) return;
		// return {
		// 	branches: branchInfo.scm.branches,
		// 	current: branchInfo.scm.current,
		// 	menuItems: branchMenuItems
		// }
		setBranches(branchInfo.scm.branches);
		setCurrentBranch(branchInfo.scm.current);
	};

	useDidMount(() => {
		getBranches();
	});

	const branchInfo = React.useMemo(async () => {
		await getBranches();
	}, [derivedState.textEditorUri]);

	const same = label == status.label && icon == status.icon;

	const save = async () => {
		setLoading(true);

		HostApi.instance.track("Status Set", { Value: status });

		if (branch.length > 0 && branch !== currentBranch && derivedState.textEditorUri) {
			const result = await HostApi.instance.send(CreateBranchRequestType, {
				branch,
				uri: derivedState.textEditorUri
			});
			// FIXME handle error
			if (result.error) {
				console.log("ERROR FROM CREATE BRANCH: ", result.error);
				setLoading(false);
				return;
			}
		}

		if (moveIssue) {
			// FIXME move the issue to the selected list
			// const response = await HostApi.instance.send(MoveThirdPartyCardRequestType, {
			// 	providerId: props.provider.id,
			// 	destinationListId: FIXME
			// 	card
			// });
		}

		// @ts-ignore
		await dispatch(setUserStatus(icon, label, expires));
		dispatch(closePanel());
		setLoading(false);
	};

	const clear = async () => {
		setLoading(true);
		HostApi.instance.track("Status Cleared", { Value: status });
		// @ts-ignore
		await dispatch(setUserStatus("", "", 0));
		dispatch(closePanel());
		setLoading(false);
	};

	const set = (icon, label) => {
		setIcon(icon);
		setLabel(label);
	};

	const clearable = same && label && label.length > 0;
	const saveable = !same;

	const handleClickEmojiButton = (event: React.SyntheticEvent) => {
		event.persist();
		setEmojiMenuTarget(event.target);
		setEmojiMenuOpen(!emojiMenuOpen);
	};

	const selectEmoji = (emoji: typeof emojiData[string]) => {
		setEmojiMenuOpen(false);
		if (emoji && emoji.colons) {
			setIcon(emoji.colons);
		}
	};

	const goSettings = () => {};

	const saveLabel =
		!branch || branch == currentBranch
			? "Save Status"
			: branches.includes(branch)
			? "Switch Branch & Save Status"
			: "Create Branch & Save Status";

	const useBranchLabel =
		branch == currentBranch
			? "Use branch"
			: branches.includes(branch)
			? "Switch to branch"
			: "Create branch";

	const makeMenuItem = (branch: string, isNew?: boolean) => {
		const iconName = isNew ? "plus" : branch == currentBranch ? "arrow-right" : "blank";
		return {
			label: branch,
			key: branch,
			icon: <Icon name={iconName} />,
			action: () => setBranch(branch)
		};
	};

	const branchMenuItems = branches.map(branch => makeMenuItem(branch, false)) as any;
	if (newBranch) {
		branchMenuItems.unshift(
			{
				label: (
					<span>
						Create{" "}
						<span className="monospace highlight">
							<b>{newBranch}</b>
						</span>
					</span>
				),
				key: newBranch,
				icon: <Icon name="plus" />,
				action: () => setBranch(newBranch)
			},
			{
				label: "Edit Branch Name",
				key: "edit",
				icon: <Icon name="pencil" />,
				action: () => setEditingBranch(true)
			},
			{
				label: "Configure Branch Naming",
				key: "configure",
				icon: <Icon name="gear" />,
				action: () => setConfigureBranchNames(true)
			},
			{ label: "-" }
		);
	}

	if (configureBranchNames)
		return <ConfigureBranchNames onClose={() => setConfigureBranchNames(false)} />;

	return (
		<div className="full-height-panel">
			<form className="standard-form vscroll" style={{ padding: "10px" }}>
				<div className="panel-header">
					What are you working on?
					<CancelButton onClick={props.closePanel} placement="left" />
				</div>
				<fieldset className="form-body" style={{ padding: "10px" }}>
					<div id="controls">
						<StatusInput>
							<div className="icon-selector">
								<span onClick={handleClickEmojiButton}>{emojiPlain(icon)}</span>
								{emojiMenuOpen && (
									<EmojiPicker addEmoji={selectEmoji} target={emojiMenuTarget} autoFocus={true} />
								)}
							</div>
							{!label ? (
								<CrossPostIssueContext.Provider
									value={{
										selectedAssignees: [],
										setValues: values => setTheLabel(values.url, values.branch),
										setSelectedAssignees: () => {}
									}}
								>
									<IssueDropdown />
								</CrossPostIssueContext.Provider>
							) : (
								<div
									className="clear"
									onClick={() => {
										set(":desktop_computer:", "");
										const input = document.getElementById("status-input");
										if (input) input.focus();
									}}
								>
									<Icon name="x" className="clickable" />
								</div>
							)}
							<input
								id="status-input"
								name="status"
								value={label}
								className="input-text control"
								autoFocus={true}
								type="text"
								onChange={e => setTheLabel(e.target.value, makeBranchName(e.target.value))}
								placeholder="Enter description, paste URL, or select issue"
							/>
						</StatusInput>
						<div style={{ paddingLeft: "6px" }}>
							{showMoveIssueCheckbox && (
								<StyledCheckbox
									name="move-issue"
									checked={moveIssue}
									onChange={v => setMoveIssue(v)}
								>
									Move this card to{" "}
									<InlineMenu items={[{ label: "foo", key: "bar" }]}>In Progress</InlineMenu>
									on Trello
								</StyledCheckbox>
							)}
							{showCreateBranchCheckbox && (
								<StyledCheckbox
									name="create-branch"
									checked={createBranch}
									onChange={v => setCreateBranch(v)}
								>
									{useBranchLabel}{" "}
									{editingBranch ? (
										<input
											id="branch-input"
											name="branch"
											value={branch}
											className="input-text control"
											autoFocus={true}
											type="text"
											onChange={e => {
												setBranch(e.target.value);
												setBranchTouched(true);
											}}
											placeholder="Enter branch name"
											onBlur={() => setEditingBranch(false)}
											onKeyPress={e => {
												if (e.key == "Enter") setEditingBranch(false);
											}}
											style={{ width: "200px" }}
										/>
									) : (
										<MonoMenu title="Branch" items={branchMenuItems}>
											{branch}
										</MonoMenu>
									)}
								</StyledCheckbox>
							)}
						</div>
						<div style={{ height: "5px" }}></div>
						<ButtonRow>
							{clearable && (
								<Button onClick={clear} isLoading={loading}>
									Clear Status
								</Button>
							)}
							{saveable && (
								<Button onClick={save} isLoading={loading}>
									{saveLabel}
								</Button>
							)}
						</ButtonRow>
					</div>
				</fieldset>
			</form>
		</div>
	);
};

// {false && label.length === 0 && (
// 	<Examples>
// 		<div onClick={() => set(":house:", "Working remotely", "today")}>
// 			<span className="emoji">{emojiPlain(":house:")}</span>
// 			Working remotely
// 			<span className="time"> &mdash; Today</span>
// 		</div>
// 		<div onClick={() => set(":bus:", "Commuting", "30")}>
// 			<span className="emoji">{emojiPlain(":bus:")}</span>
// 			Commuting
// 			<span className="time"> &mdash; 30 minutes</span>
// 		</div>
// 		<div onClick={() => set(":calendar:", "In a meeting", "60")}>
// 			<span className="emoji">{emojiPlain(":calendar:")}</span>
// 			In a meeting
// 			<span className="time"> &mdash; 1 hour</span>
// 		</div>
// 		<div onClick={() => set(":brain:", "Deep in thought", "120")}>
// 			<span className="emoji">{emojiPlain(":brain:")}</span>
// 			Deep in thought
// 			<span className="time"> &mdash; 2 hours</span>
// 		</div>
// 		<div onClick={() => set(":desktop_computer:", "Heads down", "240")}>
// 			<span className="emoji">{emojiPlain(":desktop_computer:")}</span>
// 			Heads down
// 			<span className="time"> &mdash; 4 hours</span>
// 		</div>
// 	</Examples>
// )}
