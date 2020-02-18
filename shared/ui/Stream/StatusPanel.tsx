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
const emojiData = require("../node_modules/markdown-it-emoji-mart/lib/data/full.json");

const StatusInput = styled.div`
	position: relative;
	margin-bottom: 20px;
	.icon-selector {
		position: absolute;
		left: 1px;
		top: 1px;
		border-right: 1px solid var(--base-border-color);
		// padding: 8px 10px;
		font-size: 20px;
		line-height: 20px;
		display: flex;
		width: 34px;
		height: 34px;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		span {
			display: inline-block;
			padding: 2px 0 0 2px;
			vertical-align: -15px;
		}
		&:hover {
			background: var(--app-background-color);
		}
	}
	.clear {
		position: absolute;
		right: 0;
		top: 1px;
		padding: 8px 10px;
	}
	input#status-input {
		font-size: 16px !important;
		padding: 8px 40px 8px 42px !important;
		&::placeholder {
			font-size: 16px !important;
		}
	}
`;

const ButtonRow = styled.div`
	text-align: center;
	margin-top: 20px;
	button {
		width: 10em;
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

const EMPTY_STATUS = {
	label: "",
	icon: ":smiley:",
	invisible: false,
	expires: 0
};

const formatTheDate = time => {
	const date = new Date(time);
	return date.toLocaleString();
};

export const StatusPanel = (props: { closePanel: Function }) => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const currentUser = state.users[state.session.userId!] as CSMe;
		let status =
			currentUser.status && "label" in currentUser.status ? currentUser.status : EMPTY_STATUS;
		const now = new Date().getTime();
		if (status.expires && status.expires < now) status = EMPTY_STATUS;

		const clearAfterLabel = status.expires == 0 ? "" : formatTheDate(status.expires);
		return {
			status,
			clearAfterLabel,
			notificationPreference: state.preferences.notifications || "involveMe"
		};
	});
	const { status } = derivedState;
	const [loading, setLoading] = useState(false);
	const [label, setLabel] = useState(status.label || "");
	const [invisible, setInvisible] = useState(status.invisible);
	const [icon, setIcon] = useState(status.icon || ":smiley:");
	const [clearAfter, setClearAfter] = useState("");
	const [emojiMenuOpen, setEmojiMenuOpen] = useState(false);
	const [emojiMenuTarget, setEmojiMenuTarget] = useState();

	const same =
		invisible === status.invisible && label === status.label && icon === status.icon && !clearAfter;

	const save = async () => {
		setLoading(true);
		const now = new Date();
		let expires = 0;
		console.log("CLEAR AFTER IS: ", clearAfter);
		switch (clearAfter) {
			case "1":
			case "30":
			case "60":
			case "120":
			case "240": {
				const delta = parseInt(clearAfter, 10) * 60 * 1000;
				const expiresDate = new Date(now.getTime() + delta);
				expires = expiresDate.getTime();
				break;
			}
			case "today": {
				// reset to most recent midnight...
				now.setHours(0);
				now.setMinutes(0);
				now.setSeconds(0);
				// ...then add one day
				const delta = 24 * 60 * 60 * 1000;
				const expiresDate = new Date(now.getTime() + delta);
				expires = expiresDate.getTime();
				break;
			}
			case "week": {
				// reset to most recent midnight...
				now.setHours(0);
				now.setMinutes(0);
				now.setSeconds(0);
				// ...then add seven days
				const delta = 7 * 24 * 60 * 60 * 1000;
				const expiresDate = new Date(now.getTime() + delta);
				expires = expiresDate.getTime();
				break;
			}
			case "never":
				expires = 0;
				break;
			default:
				expires = status.expires || 0;
		}

		console.log("SETTING EXPIRES TO: ", expires);
		HostApi.instance.track("Status Set", { Value: status });
		// @ts-ignore
		await dispatch(setUserStatus(icon, label, invisible, expires));
		dispatch(closePanel());
		setLoading(false);
	};

	const clear = async () => {
		setLoading(true);
		HostApi.instance.track("Status Cleared", { Value: status });
		// @ts-ignore
		await dispatch(setUserStatus("", "", invisible, 0));
		dispatch(closePanel());
		setLoading(false);
	};

	const set = (icon, label, clearAfter) => {
		setIcon(icon);
		setLabel(label);
		setClearAfter(clearAfter);
	};

	const toggleInvisible = () => {};

	const clearable = same && (label.length > 0 || icon.length > 0);
	const saveable = !same;

	const timeOptions = [
		{ label: "Don't clear", key: "never", action: "never" },
		{ label: "1 minute", key: "1", action: "1" },
		{ label: "30 minutes", key: "30", action: "30" },
		{ label: "1 hour", key: "60", action: "60" },
		{ label: "2 hours", key: "120", action: "120" },
		{ label: "4 hours", key: "240", action: "240" },
		{ label: "Today", key: "today", action: "today" },
		{ label: "This week", key: "week", action: "week" }
	];
	const timeLabels = {};
	timeOptions.forEach(option => {
		timeLabels[option.key] = option.label;
	});

	const timeLabel = (clearAfter: string | undefined) => {
		if (clearAfter) {
			return timeLabels[clearAfter];
		} else {
			return null;
		}
	};

	const setExpiresFromMenu = value => {
		setClearAfter(value);
	};

	const setTheLabel = value => {
		if (!clearAfter) setClearAfter("60");
		setLabel(value);
	};

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

	return (
		<div className="panel configure-provider-panel">
			<form className="standard-form vscroll">
				<div className="panel-header">
					<CancelButton onClick={props.closePanel} />
				</div>
				<fieldset className="form-body">
					<div id="controls">
						<StatusInput>
							<div className="icon-selector" onClick={handleClickEmojiButton}>
								<span>{emojiPlain(icon)}</span>
								{emojiMenuOpen && (
									<EmojiPicker addEmoji={selectEmoji} target={emojiMenuTarget} autoFocus={true} />
								)}
							</div>
							{label.length > 0 && (
								<div className="clear" onClick={() => set("", "", "today")}>
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
								onChange={e => setTheLabel(e.target.value)}
								placeholder="What's your status?"
							/>
						</StatusInput>
						{label.length === 0 && (
							<Examples>
								<div onClick={() => set(":house:", "Working remotely", "today")}>
									<span className="emoji">{emojiPlain(":house:")}</span>
									Working remotely
									<span className="time"> &mdash; Today</span>
								</div>
								<div onClick={() => set(":bus:", "Commuting", "30")}>
									<span className="emoji">{emojiPlain(":bus:")}</span>
									Commuting
									<span className="time"> &mdash; 30 minutes</span>
								</div>
								<div onClick={() => set(":calendar:", "In a meeting", "60")}>
									<span className="emoji">{emojiPlain(":calendar:")}</span>
									In a meeting
									<span className="time"> &mdash; 1 hour</span>
								</div>
								<div onClick={() => set(":brain:", "Deep in thought", "120")}>
									<span className="emoji">{emojiPlain(":brain:")}</span>
									Deep in thought
									<span className="time"> &mdash; 2 hours</span>
								</div>
								<div onClick={() => set(":computer:", "Heads down", "240")}>
									<span className="emoji">{emojiPlain(":computer:")}</span>
									Heads down
									<span className="time"> &mdash; 4 hours</span>
								</div>
							</Examples>
						)}
						{label.length > 0 && (
							<div style={{ padding: "0 0 20px 8px" }}>
								Clear after:{" "}
								<InlineMenu items={timeOptions} onChange={setExpiresFromMenu}>
									{clearAfter ? timeLabel(clearAfter) : derivedState.clearAfterLabel}
								</InlineMenu>
							</div>
						)}
						<div style={{ paddingLeft: "8px" }}>
							<Checkbox name="invisible" checked={!invisible} onChange={v => setInvisible(!v)}>
								Share what I'm working on with the team &nbsp;
								<a href="https://help.codestream.com/writeme-about-x-ray">
									<Icon name="info" title="Click for details" />
								</a>
							</Checkbox>
						</div>
						<ButtonRow>
							{clearable && (
								<Button onClick={clear} isLoading={loading}>
									Clear Status
								</Button>
							)}
							{saveable && (
								<Button onClick={save} isLoading={loading}>
									Save Status
								</Button>
							)}
						</ButtonRow>
					</div>
				</fieldset>
			</form>
		</div>
	);
};
