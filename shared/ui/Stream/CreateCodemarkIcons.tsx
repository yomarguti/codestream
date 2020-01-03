import React, { useState } from "react";
import { connect, useDispatch, useSelector } from "react-redux";
import cx from "classnames";
import Icon from "./Icon";
import { HostApi } from "../webview-api";
import { Range } from "vscode-languageserver-types";
import { useDidMount } from "../utilities/hooks";
import {
	EditorHighlightRangeRequestType,
	MaxRangeValue,
	EditorSelection,
	NewCodemarkNotificationType,
	EditorMetrics
} from "../ipc/webview.protocol";
import { range } from "../utils";
import { CodemarkType } from "@codestream/protocols/api";
import { setCurrentCodemark } from "../store/context/actions";
import {
	getCurrentSelection,
	getVisibleRanges,
	getLine0ForEditorLine
} from "../store/editorContext/reducer";
import { setEditorContext, changeSelection } from "../store/editorContext/actions";
import { CodeStreamState } from "../store";
import ComposeTitles from "./ComposeTitles";

interface Props {
	openIconsOnLine: number;
	codeHeight: number;
	numLinesVisible: number;
	lineHeight?: number;
	metrics: EditorMetrics;

	// FIXME -- these should not be passed as props
	composeBoxActive: boolean;
	setNewCodemarkAttributes: Function;
	switchToInlineView: Function;
}

const mapStateToProps = (state: CodeStreamState) => {
	const { context, editorContext, teams, configs, documentMarkers } = state;

	const textEditorVisibleRanges = getVisibleRanges(editorContext);
	const numVisibleRanges = textEditorVisibleRanges.length;

	let lastVisibleLine = 1;
	let firstVisibleLine = 1;
	if (numVisibleRanges > 0) {
		const lastVisibleRange = textEditorVisibleRanges[numVisibleRanges - 1];
		lastVisibleLine = lastVisibleRange!.end.line;
		firstVisibleLine = textEditorVisibleRanges[0].start.line;
	}

	return {
		viewInline: context.codemarksFileViewStyle === "inline",
		textEditorUri: editorContext.textEditorUri,
		textEditorLineCount: editorContext.textEditorLineCount || 0,
		textEditorSelections: editorContext.textEditorSelections,
		firstVisibleLine,
		lastVisibleLine,
		textEditorVisibleRanges,
		textEditorSelection: getCurrentSelection(editorContext)
	};
};

export const CreateCodemarkIcons = (props: Props) => {
	const dispatch = useDispatch();
	const [highlightedLine, setHighlightedLine] = useState();

	const derivedState = useSelector(mapStateToProps);

	useDidMount(() => {
		const disposable = HostApi.instance.on(NewCodemarkNotificationType, e => {
			handleClickPlus(undefined, e.type, undefined as any, false);
		});
		return () => disposable.dispose();
	});

	const onMouseEnterHoverIcon = lineNum0 => {
		// lineNum is 0 based
		handleHighlightLine(lineNum0);
	};

	const onMouseLeaveHoverIcon = lineNum0 => {
		// lineNum is 0 based
		handleUnhighlightLine(lineNum0);
	};

	const handleHighlightLine = line0 => {
		highlightLine(line0, true);
	};

	const handleUnhighlightLine = line0 => {
		highlightLine(line0, false);
	};
	const highlightLine = (line0, highlight) => {
		const { textEditorSelection } = derivedState;

		const mappedLineNum = mapLine0ToVisibleRange(line0);
		if (
			mappedLineNum === props.openIconsOnLine &&
			textEditorSelection &&
			(textEditorSelection.start.line !== textEditorSelection.end.line ||
				textEditorSelection.start.character !== textEditorSelection.end.character)
		) {
			return;
		}

		HostApi.instance.send(EditorHighlightRangeRequestType, {
			uri: derivedState.textEditorUri!,
			range: Range.create(mappedLineNum, 0, mappedLineNum, MaxRangeValue),
			highlight: highlight
		});

		setHighlightedLine(highlight ? line0 : null);
	};

	const handleClickPlus = async (
		event: React.SyntheticEvent | undefined,
		type: CodemarkType,
		lineNum0: number,
		shouldChangeSelection = true
	) => {
		if (event) event.preventDefault();

		const viewingInline = derivedState.viewInline;
		if (!viewingInline) {
			props.switchToInlineView();
		}

		const { textEditorSelection } = derivedState;

		const mappedLineNum = mapLine0ToVisibleRange(lineNum0);

		if (shouldChangeSelection) {
			let range: Range | undefined;
			if (
				mappedLineNum === props.openIconsOnLine &&
				textEditorSelection &&
				// if these aren't equal, we have an active selection
				(textEditorSelection.start.line !== textEditorSelection.end.line ||
					textEditorSelection.start.character !== textEditorSelection.end.character)
			) {
				range = Range.create(textEditorSelection.start, textEditorSelection.end);
			} else {
				range = Range.create(mappedLineNum, 0, mappedLineNum, MaxRangeValue);
				const newSelection: EditorSelection = { ...range, cursor: range.end };
				// HACK: although the changeSelection action creator will update the redux store,
				// this component needs to update the store pre-emptively to avoid flashing the hover button
				// before the form appears. the flash is because as the selection changes, we try to show the hover button to initiate opening the form
				dispatch(setEditorContext({ textEditorSelections: [newSelection] }));
				dispatch(changeSelection(derivedState.textEditorUri!, newSelection));
			}

			// Clear the previous highlight
			handleUnhighlightLine(lineNum0);
		}

		props.setNewCodemarkAttributes({ type, viewingInline });

		dispatch(setCurrentCodemark());
	};
	const mapLine0ToVisibleRange = fromLineNum0 => {
		const { textEditorVisibleRanges } = derivedState;

		let lineCounter = 0;
		let toLineNum = 0;
		if (textEditorVisibleRanges != null) {
			textEditorVisibleRanges.forEach(lineRange => {
				range(lineRange.start.line, lineRange.end.line + 1).forEach(thisLine => {
					if (lineCounter === fromLineNum0) toLineNum = thisLine;
					lineCounter++;
				});
			});
		}
		return toLineNum;
	};

	const renderIconRow = (lineNum0, top, hover, open) => {
		// we only add the title properties (which add tooltips)
		// when you mouse over them for performance reasons. adding
		// tool tips on each one slowed things down a lot. -Pez
		return (
			<div
				onMouseEnter={() => onMouseEnterHoverIcon(lineNum0)}
				onMouseLeave={() => onMouseLeaveHoverIcon(lineNum0)}
				className={cx("hover-plus", { hover, open })}
				key={lineNum0}
				style={{ top }}
			>
				 {(hover || open) && [
					<Icon
						key="comment"
						onClick={e => handleClickPlus(e, CodemarkType.Comment, lineNum0)}
						name="comment"
						title={ComposeTitles.comment}
						placement="bottomLeft"
						align={{ offset: [-3, 10] }}
						delay={1}
					/>, 
					<Icon
						onClick={e => handleClickPlus(e, CodemarkType.Issue, lineNum0)}
						name="issue"
						key="issue"
						title={ComposeTitles.issue}
						placement="bottomLeft"
						align={{ offset: [-3, 10] }}
						delay={1}
					/>,
					// <Icon
					// 	onClick={e => this.handleClickPlus(e, CodemarkType.Bookmark, lineNum0)}
					// 	name="bookmark"
					// 	key="bookmark"
					// 	title={ComposeTitles.bookmark}
					// 	placement="bottomLeft"
					// 	align={{ offset: [-3, 10] }}
					// 	delay={1}
					// />,
					// <Icon
					//  key="about"
					// 	onClick={e => this.handleClickPlus(e, "about", lineNum0, top)}
					// 	name="about"
					// 	title={ComposeTitles.about}
					// 	placement="bottomLeft"
					// 	align={{ offset: [-3, 10] }}
					// 	delay={1}
					// />,
					<Icon
						onClick={e => handleClickPlus(e, CodemarkType.Link, lineNum0)}
						name="link"
						key="link"
						title={ComposeTitles.link}
						placement="bottomLeft"
						align={{ offset: [-3, 10] }}
						delay={1}
					/>
				]}  
			</div>
		);
	};

	const { codeHeight, numLinesVisible, metrics } = props;

	const iconsOnLine0 = getLine0ForEditorLine(
		derivedState.textEditorVisibleRanges,
		props.openIconsOnLine
	);
	// console.log("IOL IS: ", iconsOnLine0, " FROM: ", this.state.openIconsOnLine);

	// if the compose box is active, don't render the
	// hover icons. even though you could technically
	// argue that this is a loss of fucntionality
	// (one extra click to reposition the compose box)
	// the UX is just too weird/messy keeping those
	// buttons active. see google docs for comparison,
	// who hide the (+) when you have a compose box
	if (props.composeBoxActive) return null;

	// console.log("**********************************************");
	// console.log("WINDOW HEIGHT: ", window.innerHeight);
	// console.log("codeHeight: ", codeHeight);
	// console.log("numLinesVisible: ", numLinesVisible);
	// console.log("lineHeight: ", codeHeight / numLinesVisible);
	// console.log("lineHeightApprox: ", codeHeight / (numLinesVisible + 1));
	// console.log("lineHeightProps", props.lineHeight);

	const lineHeight = props.lineHeight || codeHeight / numLinesVisible;
	const paddingTop = (metrics && metrics.margins && metrics.margins.top) || 0;

	if (iconsOnLine0 >= 0) {
		// const top = (codeHeight * iconsOnLine0) / (numLinesVisible + 1);
		// const top = paddingTop ? "calc(" + topPct + " + " + paddingTop + "px)" : topPct;
		const top = lineHeight * iconsOnLine0 + paddingTop;
		if (derivedState.textEditorSelections && derivedState.textEditorSelections.length == 0)
			return renderIconRow(iconsOnLine0, top, false, false);	// suppress compose icon, editor selections is 1 when just cursor is in file 
		else
			return renderIconRow(iconsOnLine0, top, false, true);
	} else {
		// const heightPerLine = (window.innerHeight - 22) / (numLinesVisible + 2);
		return (
			<>
				{range(0, numLinesVisible).map(lineNum0 => {
					// const top = (codeHeight * lineNum0) / (numLinesVisible + 1);
					const top = lineHeight * lineNum0 + paddingTop;
					// const top = paddingTop ? "calc(" + topPct + " + " + paddingTop + "px)" : topPct;
					const hover = lineNum0 === highlightedLine;
					return renderIconRow(lineNum0, top, hover, false);
				})}
			</>
		);
	}
};
