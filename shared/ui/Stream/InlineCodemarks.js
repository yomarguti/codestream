// @ts-check
import React, { Component } from "react";
import { connect } from "react-redux";
import * as userSelectors from "../store/users/reducer";
import Icon from "./Icon";
import Codemark from "./Codemark";
import ScrollBox from "./ScrollBox";
import Feedback from "./Feedback";
import createClassString from "classnames";
import { range } from "../utils";
import { HostApi } from "../webview-api";
import {
	EditorHighlightRangeRequestType,
	EditorRevealRangeRequestType,
	UpdateConfigurationRequestType,
	MaxRangeValue
} from "../ipc/webview.protocol";
import {
	DocumentMarker,
	TelemetryRequestType,
	DidChangeDocumentMarkersNotificationType,
	DocumentFromMarkerRequestType
} from "@codestream/protocols/agent";
import { Range } from "vscode-languageserver-types";
import { fetchDocumentMarkers } from "../store/documentMarkers/actions";
import { getCurrentSelection } from "../store/editorContext/reducer";
import { setCurrentStream } from "../store/context/actions";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//   Note that there is a big potential for off-by-one errors in this file, because the webview line numbers are
//   0-based, and the linenumbers in the editor are 1-based. I've tried to make it more clear which is which by
//   naming the 0-based line number variables with a "0" at the end, for example line0 or lineNum0. Hopefully
//   this helps avoid some confusion... please stick with this paradigm unless you really hate it, in which case
//   please talk to me first. Thanks. -Pez
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * @augments {Component<{ textEditorVisibleRanges?: Range[], documentMarkers: DocumentMarker[],[key: string]: any }, {  [key: string]: any }>}
 */
export class SimpleInlineCodemarks extends Component {
	disposables = [];

	constructor(props) {
		super(props);

		this.state = {
			isLoading: props.documentMarkers.length === 0,
			openPost: null
		};

		const modifier = navigator.appVersion.includes("Macintosh") ? "^ /" : "Ctrl-Shift-/";
		this.titles = {
			comment: (
				<span>
					Add Comment <span className="keybinding extra-pad">{modifier}</span>
					<span className="keybinding">c</span>
				</span>
			),
			bookmark: (
				<span>
					Create Bookmark <span className="keybinding extra-pad">{modifier}</span>
					<span className="keybinding">b</span>
				</span>
			),
			link: (
				<span>
					Get Permalink <span className="keybinding extra-pad">{modifier}</span>
					<span className="keybinding">p</span>
				</span>
			),
			issue: (
				<span>
					Create Issue <span className="keybinding extra-pad">{modifier}</span>
					<span className="keybinding">i</span>
				</span>
			)
		};
	}

	static getDerivedStateFromProps(props, state) {
		let { textEditorSelection } = props;

		if (!textEditorSelection) {
			return { openIconsOnLine: 0, lastSelectedLine: 0 };
		}

		if (
			textEditorSelection.start.line !== textEditorSelection.end.line ||
			textEditorSelection.start.character !== textEditorSelection.end.character
		) {
			if (state.clickedPlus) {
				return {
					openIconsOnLine: -1,
					clickedPlus: false,
					lastSelectedLine: textEditorSelection.cursor.line
				};
			}
			if (textEditorSelection.cursor.line !== state.lastSelectedLine) {
				return {
					openIconsOnLine: textEditorSelection.cursor.line,
					lastSelectedLine: textEditorSelection.cursor.line
				};
			}
		} else {
			return { openIconsOnLine: -1, lastSelectedLine: -1 };
		}

		return null;
	}

	componentDidMount() {
		this.disposables.push(
			HostApi.instance.on(DidChangeDocumentMarkersNotificationType, ({ textDocument }) => {
				if (this.props.textEditorUri === textDocument.uri)
					this.props.fetchDocumentMarkers(textDocument.uri);
			})
		);

		this.props.fetchDocumentMarkers(this.props.textEditorUri).then(() => {
			this.setState(state => (state.isLoading ? { isLoading: false } : null));
		});

		this.setVisibleLinesCount();
	}

	componentDidUpdate(prevProps, prevState) {
		const { textEditorUri } = this.props;
		if (String(textEditorUri).length > 0 && prevProps.textEditorUri !== textEditorUri) {
			this.onFileChanged();
			this.setVisibleLinesCount();
		}

		const didStartLineChange = this.compareStart(
			this.props.textEditorVisibleRanges,
			prevProps.textEditorVisibleRanges
		);
		if (didStartLineChange) this.setVisibleLinesCount();
	}

	componentWillUnmount() {
		this.disposables.forEach(d => d.dispose());
	}

	async onFileChanged() {
		const { textEditorUri, documentMarkers } = this.props;
		if (documentMarkers.length === 0)
			this.setState(state => (state.isLoading ? null : { isLoading: true }));
		await this.props.fetchDocumentMarkers(textEditorUri);
		this.setState(state => (state.isLoading ? { isLoading: false } : null));
	}

	setVisibleLinesCount = () => {
		const { textEditorVisibleRanges } = this.props;

		let numLinesVisible = 0;
		if (textEditorVisibleRanges != null) {
			textEditorVisibleRanges.forEach(range => {
				numLinesVisible += range.end.line - range.start.line + 1;
			});
		}

		// only set this if it changes by more than 1. we expect it to vary by 1 as
		// the topmost and bottommost line are revealed and the window is not an integer
		// number of lines high.
		if (Math.abs(numLinesVisible - Number(this.state.numLinesVisible || 0)) > 1) {
			this.setState({ numLinesVisible });
		}
	};

	/**
	 * @param {Range[] | undefined} range1
	 * @param {Range[] | undefined} range2
	 */
	compareStart(range1, range2) {
		if (range1 == null || range1.length === 0 || range2 == null || range2.length === 0) return true;
		const start1 = range1[0].start.line;
		const start2 = range2[0].start.line;
		return start1 !== start2;
	}

	renderList = () => {
		const { documentMarkers } = this.props;

		if (documentMarkers.length === 0) {
			return this.renderNoCodemarks();
		}

		return (
			<ScrollBox>
				<div className="inline-codemarks channel-list vscroll">
					<div
						className={createClassString("section", "has-children", {
							expanded: true
						})}
					>
						<div className="header top">
							<Icon name="triangle-right" className="triangle-right" />
							<span>
								In This File: <span className="filename">{this.props.fileNameToFilterFor}</span>
							</span>
						</div>

						{documentMarkers
							.sort((a, b) => b.createdAt - a.createdAt)
							.map(docMarker => {
								const { codemark } = docMarker;
								// @ts-ignore
								if (!codemark.pinned) return null;
								return (
									<Codemark
										key={codemark.id}
										// @ts-ignore
										codemark={docMarker.codemark}
										marker={docMarker}
										collapsed={this.state.openPost !== codemark.id}
										inline={false}
										currentUserName={this.props.currentUserName}
										usernames={this.props.usernames}
										onClick={this.handleClickCodemark}
										onMouseEnter={this.handleHighlightCodemark}
										onMouseLeave={this.handleUnhighlightCodemark}
										action={this.props.postAction}
										query={this.state.q}
									/>
								);
							})}
					</div>
				</div>
			</ScrollBox>
		);
	};

	onMouseEnterHoverIcon = lineNum0 => {
		// lineNum is 0 based
		this.handleHighlightLine(lineNum0);
	};

	onMouseLeaveHoverIcon = lineNum0 => {
		// lineNum is 0 based
		this.handleUnhighlightLine(lineNum0);
		// this.setState({ openIconsOnLine: undefined });
	};

	renderIconRow(lineNum0, top, hover, open) {
		// we only add the title properties (which add tooltips)
		// when you mouse over them for performance reasons. adding
		// tool tips on each one slowed things down a lot. -Pez
		return (
			<div
				onMouseEnter={() => this.onMouseEnterHoverIcon(lineNum0)}
				onMouseLeave={() => this.onMouseLeaveHoverIcon(lineNum0)}
				className={createClassString("hover-plus", { open, hover })}
				key={lineNum0}
				style={{ top }}
			>
				<Icon
					onClick={e => this.handleClickPlus(e, "comment", lineNum0)}
					name="comment"
					title={hover ? this.titles.comment : undefined}
					placement="bottomLeft"
					delay={1}
				/>
				<Icon
					onClick={e => this.handleClickPlus(e, "issue", lineNum0)}
					name="issue"
					title={hover ? this.titles.issue : undefined}
					placement="bottomLeft"
					delay={1}
				/>
				<Icon
					onClick={e => this.handleClickPlus(e, "bookmark", lineNum0)}
					name="bookmark"
					title={hover ? this.titles.bookmark : undefined}
					placement="bottomLeft"
					delay={1}
				/>
				<Icon
					onClick={e => this.handleClickPlus(e, "link", lineNum0)}
					name="link"
					title={hover ? this.titles.link : undefined}
					placement="bottomLeft"
					delay={1}
				/>
			</div>
		);
	}

	renderHoverIcons = numLinesVisible => {
		const { textEditorSelection, metrics } = this.props;
		const iconsOnLine0 = this.mapVisibleRangeToLine0(this.state.openIconsOnLine);
		// console.log("IOL IS: ", iconsOnLine0, " FROM: ", this.state.openIconsOnLine);
		const highlightedLine = this.state.highlightedLine;

		if (iconsOnLine0 >= 0) {
			const top = (100 * iconsOnLine0) / numLinesVisible + "%";
			// const top = paddingTop ? "calc(" + topPct + " + " + paddingTop + "px)" : topPct;
			return this.renderIconRow(iconsOnLine0, top, false, true);
		} else {
			const heightPerLine = (window.innerHeight - 22) / (numLinesVisible + 2);
			return (
				<div>
					{range(0, numLinesVisible).map(lineNum0 => {
						const top = (100 * lineNum0) / numLinesVisible + "%";
						// const top = paddingTop ? "calc(" + topPct + " + " + paddingTop + "px)" : topPct;
						const hover = lineNum0 === highlightedLine;
						return this.renderIconRow(lineNum0, top, hover, false);
					})}
					<div style={{ position: "fixed", bottom: "30px", right: "20px", whiteSpace: "pre" }}>
						{JSON.stringify(metrics)} height: {heightPerLine} numVisible: {numLinesVisible}
					</div>
				</div>
			);
		}
	};

	renderNoCodemarks = () => {
		const { fileNameToFilterFor, viewInline } = this.props;

		if (fileNameToFilterFor && fileNameToFilterFor.length) {
			const target = viewInline ? "an icon" : "the lightbulb";
			return (
				<div key="no-codemarks" className="no-codemarks">
					There are no codemarks
					<Icon
						title="A codemark is a link between a block of code and a conversation, an issue, or a bookmark. Codemarks work across branches, and stay pinned to the block of code even as your codebase changes."
						placement="top"
						className="superscript"
						name="info"
					/>{" "}
					in {this.props.fileNameToFilterFor}
					<br />
					<br />
					Discuss code with your team by selecting a range and clicking {target} (
					<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Building-a-Knowledge-Base-with-Codemarks">
						show me how
					</a>
					).
				</div>
			);
		} else {
			return (
				<div key="no-codemarks" className="no-codemarks">
					No file selected.{" "}
					<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Building-a-Knowledge-Base-with-Codemarks">
						View guide.
					</a>
				</div>
			);
		}
	};

	getMarkerStartLine = marker => {
		if (marker.range) {
			return marker.range.start.line;
		}

		return marker.locationWhenCreated[0] - 1;
	};

	renderInline() {
		const { textEditorVisibleRanges, documentMarkers, metrics } = this.props;

		// create a map from start-lines to the codemarks that start on that line
		let docMarkersByStartLine = {};
		documentMarkers.forEach(docMarker => {
			// @ts-ignore
			if (!docMarker.codemark.pinned) return;
			let startLine = Number(this.getMarkerStartLine(docMarker));
			// if there is already a codemark on this line, keep skipping to the next one
			while (docMarkersByStartLine[startLine]) startLine++;
			docMarkersByStartLine[startLine] = docMarker;
		});

		const { numLinesVisible } = this.state;

		// console.log("TEVR: ", textEditorVisibleRanges);

		const numVisibleRanges =
			textEditorVisibleRanges === undefined ? 0 : textEditorVisibleRanges.length;

		const fontSize = metrics && metrics.fontSize ? metrics.fontSize : "12px";
		let rangeStartOffset = 0;

		const paddingTop = metrics.margins ? metrics.margins.top : 0;
		// we add two here because the editor only reports *entirely* visible lines,
		// so there could theoretically be one line that is 99% visible at the top,
		// and also one line that is 99% visible at the bottom, both at the same time.
		const heightPerLine = (window.innerHeight - paddingTop) / (numLinesVisible + 2);
		const expectedLineHeight = (metrics.fontSize || 12) * 1.5;
		const height =
			heightPerLine > expectedLineHeight
				? expectedLineHeight * numLinesVisible + paddingTop + "px"
				: "calc(100vh - " + paddingTop + "px)";
		const divStyle = {
			top: paddingTop,
			background: "#333366",
			position: "relative",
			fontSize: fontSize,
			height: height
		};
		console.log("HEIGHT IS: ", height);

		if (documentMarkers.length === 0) {
			return (
				<div
					style={{
						top: paddingTop,
						background: "#333366",
						position: "relative",
						fontSize: fontSize,
						height: height
					}}
				>
					{this.renderHoverIcons(numLinesVisible)}
					{this.renderNoCodemarks()}
				</div>
			);
		}

		return (
			<div
				style={{
					top: paddingTop,
					background: "#333366",
					position: "relative",
					fontSize: fontSize,
					height: height
				}}
			>
				<div
					className="inline-codemarks-x vscroll-x"
					// TODO: Get scroll to work
					// onScroll={this.onScroll}
					ref={ref => (this._scrollDiv = ref)}
				>
					<div>
						{(textEditorVisibleRanges || []).map((lineRange, rangeIndex) => {
							const realFirstLine = lineRange.start.line; // == 0 ? 1 : lineRange[0].line;
							const realLastLine = lineRange.end.line;
							const linesInRange = realLastLine - realFirstLine + 1;
							const marksInRange = range(realFirstLine, realLastLine + 1).map(lineNum => {
								const top =
									(100 * (rangeStartOffset + lineNum - realFirstLine)) / numLinesVisible + "%";
								if (docMarkersByStartLine[lineNum] && lineNum !== this.state.openIconsOnLine) {
									const docMarker = docMarkersByStartLine[lineNum];
									return (
										<Codemark
											key={docMarker.id}
											codemark={docMarker.codemark}
											marker={docMarker}
											collapsed={this.state.openPost !== docMarker.id}
											inline={true}
											currentUserName={this.props.currentUserName}
											usernames={this.props.usernames}
											onClick={this.handleClickCodemark}
											onMouseEnter={this.handleHighlightCodemark}
											onMouseLeave={this.handleUnhighlightCodemark}
											action={this.props.postAction}
											query={this.state.q}
											lineNum={lineNum}
											style={{ top }}
										/>
									);
								} else {
									return null;
								}
							});
							rangeStartOffset += linesInRange;
							if (rangeIndex + 1 < numVisibleRanges) {
								let top = (100 * rangeStartOffset) / numLinesVisible + "%";
								marksInRange.push(<div style={{ top }} className="folded-code-indicator" />);
							}
							return marksInRange;
						})}
					</div>
					{this.renderHoverIcons(numLinesVisible)}
				</div>
			</div>
		);
	}

	onScroll = event => {
		if (this._scrolling) {
			this._scrolling = false;
			return;
		}
		const top = event.target.scrollTop;
		// we subtract 27 for two reasons:
		// 1) 18 (one line height) because line numbers start at 1 (1-indexed array vs 0-indexed)
		// 2) 9 is half a line, because we want it to scroll halfway through the line
		const line = Math.round((top - 27) / 18);
		if (line < 0) return;

		HostApi.instance.send(EditorRevealRangeRequestType, {
			uri: this.props.textEditorUri,
			range: Range.create(line, 0, line, 0),
			preserveFocus: true
		});
	};

	render() {
		const { viewInline } = this.props;

		return (
			<div className={createClassString("panel", { "full-height": viewInline })}>
				<div className="view-as-switch">
					<span className="view-as-label">View:</span>
					<label
						className={createClassString("switch view-as-inline-switch", {
							checked: viewInline
						})}
						onClick={this.toggleViewCodemarksInline}
					/>
				</div>
				{!viewInline && <div className="panel-header">Codemarks</div>}
				{this.state.isLoading ? null : viewInline ? this.renderInline() : this.renderList()}
				<Feedback />
			</div>
		);
	}

	toggleViewCodemarksInline = () => {
		HostApi.instance.send(UpdateConfigurationRequestType, {
			name: "viewCodemarksInline",
			value: !this.props.viewInline
		});
	};

	handleClickPlus = async (event, type, lineNum0) => {
		event.preventDefault();
		this.props.setNewPostEntry("Spatial View");

		const { openIconsOnLine } = this.state;
		const { textEditorSelection } = this.props;

		const mappedLineNum = this.mapLine0ToVisibleRange(lineNum0);

		let range,
			setSelection = false;
		if (
			mappedLineNum === openIconsOnLine &&
			// if these aren't equal, we have an active selection
			(textEditorSelection.start.line !== textEditorSelection.end.line ||
				textEditorSelection.start.character !== textEditorSelection.end.character)
		) {
			range = Range.create(textEditorSelection.start, textEditorSelection.end);
		} else {
			range = Range.create(mappedLineNum, 0, mappedLineNum, MaxRangeValue);
			setSelection = true;
		}

		// Clear the previous highlight
		this.handleUnhighlightLine(lineNum0);

		// Clear the open icons
		// this works subtly... we tell state to not open icons on any line,
		// but normally getDerivedStateFromProps would override that. By
		// resetting openIconsOnLine but *not* lastSelectedLine,
		// getDerivedStateFromProps won't fire.
		this.setState({ clickedPlus: true });

		// setup git context for codemark form
		this.props.setMultiCompose(
			true,
			{ commentType: type },
			{ uri: this.props.textEditorUri, range: range, setSelection: setSelection }
		);
		// setTimeout(() => this.props.focusInput(), 500);
	};

	handleClickCodemark = async codemark => {
		HostApi.instance.send(TelemetryRequestType, {
			eventName: "Codemark Clicked",
			properties: {
				"Codemark Location": "Spatial View"
			}
		});

		let markerId;
		if (codemark.markers) {
			markerId = codemark.markers[0].id;
		} else if (codemark.markerIds) {
			markerId = codemark.markerIds[0];
		}

		if (markerId) {
			const response = await HostApi.instance.send(DocumentFromMarkerRequestType, {
				markerId: markerId
			});
			// TODO: What should we do if we don't find the marker? Is that possible?
			if (response) {
				HostApi.instance.send(EditorRevealRangeRequestType, {
					uri: response.textDocument.uri,
					range: response.range,
					preserveFocus: true
				});
			}
		}
		this.props.setCurrentStream(codemark.streamId, codemark.parentPostId || codemark.postId);
		// const isOpen = this.state.openPost === id;
		// if (isOpen) this.setState({ openPost: null });
		// else {
		// this.setState({ openPost: id });
		// }
	};

	async highlightCode(marker, highlight) {
		let range = marker.range;
		if (!range) {
			const response = await HostApi.instance.send(DocumentFromMarkerRequestType, {
				markerId: marker.id
			});
			// TODO: What should we do if we don't find the marker?
			if (response === undefined) return;

			range = response.range;
		}

		HostApi.instance.send(EditorHighlightRangeRequestType, {
			uri: this.props.textEditorUri,
			range: range,
			highlight: highlight
		});
	}

	handleHighlightCodemark = marker => {
		this.highlightCode(marker, true);
	};

	handleUnhighlightCodemark = marker => {
		this.highlightCode(marker, false);
	};

	mapLine0ToVisibleRange = fromLineNum0 => {
		const { textEditorVisibleRanges } = this.props;

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

	// the opposite of mapLine0ToVisibleRange
	mapVisibleRangeToLine0 = fromLineNum => {
		const { textEditorVisibleRanges } = this.props;

		let lineCounter = 0;
		let toLineNum0 = -1; // -1 indicates we didn't find it
		if (textEditorVisibleRanges != null) {
			textEditorVisibleRanges.forEach(lineRange => {
				range(lineRange.start.line, lineRange.end.line + 1).forEach(thisLine => {
					if (thisLine === fromLineNum) toLineNum0 = lineCounter;
					lineCounter++;
				});
			});
		}
		return toLineNum0;
	};

	highlightLine(line0, highlight) {
		const { openIconsOnLine } = this.state;
		const { textEditorSelection } = this.props;

		const mappedLineNum = this.mapLine0ToVisibleRange(line0);
		if (
			mappedLineNum === openIconsOnLine &&
			(textEditorSelection.start.line !== textEditorSelection.end.line ||
				textEditorSelection.start.character !== textEditorSelection.end.character)
		) {
			return;
		}

		HostApi.instance.send(EditorHighlightRangeRequestType, {
			uri: this.props.textEditorUri,
			range: Range.create(mappedLineNum, 0, mappedLineNum, MaxRangeValue),
			highlight: highlight
		});

		this.setState({ highlightedLine: highlight ? line0 : null });
	}

	handleHighlightLine = line0 => {
		this.highlightLine(line0, true);
	};

	handleUnhighlightLine = line0 => {
		this.highlightLine(line0, false);
	};
}

const EMPTY_ARRAY = [];

const mapStateToProps = state => {
	const { capabilities, context, editorContext, teams, configs, documentMarkers } = state;

	return {
		usernames: userSelectors.getUsernames(state),
		team: teams[context.currentTeamId],
		viewInline: configs.viewCodemarksInline,
		fileNameToFilterFor: editorContext.activeFile || editorContext.lastActiveFile,
		textEditorUri: editorContext.textEditorUri,
		textEditorVisibleRanges: editorContext.textEditorVisibleRanges || EMPTY_ARRAY,
		textEditorSelection: getCurrentSelection(editorContext),
		metrics: editorContext.metrics || EMPTY_ARRAY,
		documentMarkers: documentMarkers[editorContext.textEditorUri] || EMPTY_ARRAY,
		capabilities
	};
};

export default connect(
	mapStateToProps,
	{ fetchDocumentMarkers, setCurrentStream }
)(SimpleInlineCodemarks);
