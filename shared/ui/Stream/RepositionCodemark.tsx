import cx from "classnames";
import React, { useState } from "react";
import { connect, useSelector, useDispatch } from "react-redux";
import Icon from "./Icon";
import Button from "./Button";
import { CodemarkPlus } from "@codestream/protocols/agent";
import { HostApi } from "../webview-api";
import { TelemetryRequestType } from "@codestream/protocols/agent";
import { Range } from "vscode-languageserver-protocol";
import { setCurrentCodemark, repositionCodemark } from "../store/context/actions";
import { CodeStreamState } from "../store";
import { getCurrentSelection } from "../store/editorContext/reducer";

const noop = () => Promise.resolve();

interface Props {
	cancel: Function;
	codemark: CodemarkPlus;
	range?: Range;
	file?: string;
}

export const RepositionCodemark = (connect(undefined) as any)((props: Props) => {
	const dispatch = useDispatch();
	const [loading, setLoading] = useState(false);
	const [scm, setScm] = useState();

	const reposition = () => {
		setLoading(true);
		let location = "Same File";
		// const { file: newFile, repoPath: newRepo } = scm;
		// const { file, repo } = props.marker;
		// if (repo !== newRepo) location = "Different Repo";
		// else if (file !== newFile) location = "Different File";

		// console.log("LOCATION IS: ", location);
		HostApi.instance.track("RepositionCodemark", { "New Location": location });
		// HostApi.instance.send(ApplyMarkerRequestType, { marker: props.codemark.markers![0] });
		// HostApi.instance.send(SetCodemarkRangeRequestType, {
		// 	codemark: props.codemark,
		// 	commitSHA: "foo",
		// 	range: makeRange()
		// });
		setLoading(false);
		cancel();
	};

	const textEditorSelection = useSelector((state: CodeStreamState) => {
		return getCurrentSelection(state.editorContext);
	});
	const textEditorUri = useSelector((state: CodeStreamState) => {
		return state.editorContext.textEditorUri;
	});

	const makeRange = () => {};

	const renderRange = (file, range) => {
		if (!range && props.codemark.markers) {
			const location = props.codemark.markers[0].locationWhenCreated;
			range = {
				start: { line: location[0] - 1, character: location[1] - 1 },
				end: { line: location[2] - 1, character: location[3] - 1 }
			};
			file = props.codemark.markers[0].file;
		}
		if (!range) {
			return (
				<span className="repo-warning">
					<Icon name="question" /> <b>Unknown</b>
				</span>
			);
		}
		const { start, end } = range;
		const rangeString =
			"" +
			(start.line + 1) +
			":" +
			(start.character + 1) +
			"-" +
			(end.line + 1) +
			":" +
			(end.character + 1);
		return (
			<span className="monospace">
				<Icon name="file" /> {file} <b className="highlight">{rangeString}</b>
			</span>
		);
	};

	const selectPropmpt = (
		<span className="info-text">
			<Icon name="info" /> <b>Select a new range to reposition this codemark.</b>
		</span>
	);

	const isRangeDifferent = () => {
		// if we don't know where the
		if (!props.range) return true;
		if (textEditorUri !== props.file) return true;

		// cursor is at the begging of the codemark range. this is where it starts,
		// so we assume it hasn't been moved
		if (
			textEditorSelection.start.line === props.range.start.line &&
			textEditorSelection.end.line === props.range.start.line &&
			textEditorSelection.start.character === 0 &&
			textEditorSelection.end.character === 0
		) {
			return false;
		}

		// same exact range
		if (
			textEditorSelection.start.line === props.range.start.line &&
			textEditorSelection.end.line === props.range.end.line &&
			textEditorSelection.start.character === props.range.start.character &&
			textEditorSelection.end.character === props.range.end.character
		) {
			return false;
		}

		return true;
	};

	const renderNewRange = () => {
		if (!props.range) return selectPropmpt;
		if (!textEditorSelection) return selectPropmpt;
		if (!isRangeDifferent()) return selectPropmpt;
		return renderRange(textEditorUri, textEditorSelection);
	};

	const cancel = React.useCallback(() => {
		dispatch(setCurrentCodemark());
		// if (codemark) dispatch(repositionCodemark(codemark.id, false));
	}, []);

	return (
		<div id="reposition-blanket">
			<div className="reposition-dialog">
				<form id="reposition-form" className="standard-form">
					<fieldset className="form-body">
						<div id="controls">
							<div className="related" style={{ marginTop: 0 }}>
								<div className="related-label">ORIGINAL RANGE</div>
								{renderRange(props.file, props.range)}
							</div>
							<div className="related">
								<div className="related-label">NEW RANGE</div>
								{renderNewRange()}
							</div>
							<div id="switches" className="control-group">
								<div style={{ display: "none" }} onClick={() => false}>
									<div className={cx("switch", { checked: true })} /> Include replies
								</div>
							</div>
						</div>
						<div
							key="buttons"
							className="button-group"
							style={{
								marginLeft: "10px",
								marginTop: "5px",
								float: "right",
								width: "auto",
								marginRight: 0
							}}
						>
							<Button
								key="cancel"
								style={{
									paddingLeft: "10px",
									paddingRight: "10px",
									width: "auto"
								}}
								className="control-button cancel"
								type="submit"
								onClick={cancel}
							>
								Cancel
							</Button>
							<Button
								key="submit"
								style={{
									paddingLeft: "10px",
									paddingRight: "10px",
									marginRight: 0
								}}
								className="control-button"
								type="submit"
								loading={loading}
								disabled={isRangeDifferent() ? false : true}
								onClick={reposition}
							>
								Save New Position
							</Button>
						</div>
					</fieldset>
				</form>
			</div>
		</div>
	);
});
