import cx from "classnames";
import React, { useState, useCallback } from "react";
import { connect } from "react-redux";
import Button from "./Button";
import Tooltip from "./Tooltip";
import { CSCodemark } from "@codestream/protocols/api";

const noop = () => Promise.resolve();

interface Props {
	cancel: Function;
	codemark: CSCodemark;
	access: "permissive" | "strict";
}

export const InjectAsComment = (connect(undefined) as any)((props: Props) => {
	const [useTimestamps, setUseTimestamps] = useState(true);
	const [archive, setArchive] = useState(true);
	const [wrapAt80, setWrapAt80] = useState(true);
	const [isLoading, setIsLoading] = useState(false);

	const inject = () => {
		setIsLoading(true);
	};

	const modifier = navigator.appVersion.includes("Macintosh") ? "⌘" : "Alt";

	const injectTip = 				<span>
	Submit Comment<span className="keybinding extra-pad">{modifier} ENTER</span>
</span>
const cancelTip = (
	<span>
		Cancel<span className="keybinding extra-pad">ESC</span>
	</span>
);


	return (
		<form id="inject-form" className="standard-form vscroll">
			<fieldset className="form-body">
				{ /* <p className="explainer">describe what is happening here</p> */ }
				<div id="controls">
					<div id="comment-style" className="control-group">
						<h4>Comment Style</h4>
						<div className="monospace">
							<input type="radio" name="comment-style"></input> // the quick brown fox<br></br>
							<input type="radio" name="comment-style"></input> /* the quick brown fox */<br></br>
							<input type="radio" name="comment-style"></input> # the quick brown fox<br></br>
							<input type="radio" name="comment-style"></input> {"<!-- the quick brown fox -->"}<br></br>
							<input type="radio" name="comment-style"></input> ' the quick brown fox<br></br>
							<input type="radio" name="comment-style"></input> the quick brown fox<br></br>
						</div>
					</div>
					<div id="use-timestampes" className="control-group">
						<h4>Include replies</h4>
						<div>
							<input type="radio" name="comment-style"></input> none<br></br>
							<input type="radio" name="comment-style"></input> only starred replies<br></br>
							<input type="radio" name="comment-style"></input> all replies<br></br>
						</div>
					</div>
					<div id="use-timestampes" className="control-group">
						<div onClick={() => setUseTimestamps(!useTimestamps)}>
							<div className={cx("switch", { checked: useTimestamps })} />{" "}
							Wrap at 80 chars
						</div>
						<div onClick={() => setArchive(!archive)}>
							<div className={cx("switch", { checked: archive })} />{" "}
							Archive codemark after injecting
						</div>
					</div>
				</div>
				<div
				key="buttons"
				className="button-group"
				style={{
					marginLeft: "10px",
					marginTop: "10px",
					float: "right",
					width: "auto",
					marginRight: 0
				}}
			>
					<Tooltip title={cancelTip} placement="bottom" delay={1}>
					<Button
						key="cancel"
						style={{
							paddingLeft: "10px",
							paddingRight: "10px",
							width: "auto"
						}}
						className="control-button cancel"
						type="submit"
						onClick={props.cancel}
					>
						Cancel
					</Button>
				</Tooltip>
				<Tooltip title={injectTip} placement="bottom" delay={1}>
					<Button
						key="submit"
						style={{
							paddingLeft: "10px",
							paddingRight: "10px",
							// fixed width to handle the isLoading case
							width: "80px",
							marginRight: 0
						}}
						className="control-button"
						type="submit"
						loading={isLoading}
						onClick={inject}
					>
Inject
					</Button>
				</Tooltip>
		</div>
			</fieldset>
		</form>
	);
});
