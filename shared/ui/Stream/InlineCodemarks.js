// @ts-check
import React, { Component } from "react";
import { connect } from "react-redux";
import * as userSelectors from "../store/users/reducer";
import Icon from "./Icon";
import Codemark from "./Codemark";
import ScrollBox from "./ScrollBox";
import Tooltip from "./Tooltip";
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
	GetRangeScmInfoRequestType,
	TelemetryRequestType,
	DidChangeDocumentMarkersNotificationType,
	DocumentFromMarkerRequestType
} from "@codestream/protocols/agent";
import { Range } from "vscode-languageserver-types";
import { fetchDocumentMarkers } from "../store/documentMarkers/actions";
import { setThread } from "../store/context/actions";

/**
 * @augments {Component<{ textEditorVisibleRanges?: Range[], documentMarkers: DocumentMarker[],[key: string]: any }, {  [key: string]: any }>}
 */
export class SimpleInlineCodemarks extends Component {
	disposables = [];
	editorMarkersEnabled = false;

	constructor(props) {
		super(props);

		this.state = {
			isLoading: props.documentMarkers.length === 0,
			openPost: null
		};
	}

	static getDerivedStateFromProps(props, state) {
		let { selection } = props;

		if (!selection) {
			return { openPlusOnLine: 0, lastSelectedLine: 0 };
		}

		if (selection.cursor.line !== state.lastSelectedLine) {
			return { openPlusOnLine: selection.cursor.line, lastSelectedLine: selection.cursor.line };
		}

		return null;
	}

	componentDidMount() {
		HostApi.instance.send(UpdateConfigurationRequestType, {
			name: "showMarkers",
			value: this.editorMarkersEnabled
		});
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
		const { textEditorVisibleRanges } = this.props;

		const { textEditorUri } = this.props;
		if (String(textEditorUri).length > 0 && prevProps.textEditorUri !== textEditorUri) {
			this.onFileChanged();
		}

		const didStartLineChange = this.compareStart(
			textEditorVisibleRanges,
			prevProps.textEditorVisibleRanges
		);

		// if (false && textEditorFirstLine !== prevProps.textEditorFirstLine) {
		// 	const top = (textEditorFirstLine === 0 ? 1 : textEditorFirstLine + 0.65) * 18;
		// 	// this._scrollDiv.scrollTop = Math.round(top) + "px";
		// 	this._scrolling = true;
		// 	document.getElementsByClassName("inline-codemarks")[0].scrollTop = Math.round(top);
		// }
		if (didStartLineChange) this.setVisibleLinesCount();
	}

	componentWillUnmount() {
		HostApi.instance.send(UpdateConfigurationRequestType, { name: "showMarkers", value: true });
		this.disposables.forEach(d => d.dispose());
	}

	async onFileChanged() {
		const { textEditorUri, documentMarkers } = this.props;
		if (documentMarkers.length === 0) this.setState({ isLoading: true });
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
		numLinesVisible += 1; // vscode mis-reports the last line as being 2 bigger than it is

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
		return start1 === start2;
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
										codemark={codemark}
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

	onMouseEnterHoverIcon = lineNum => {
		// lineNum is 0 based
		this.handleHighlightLine(lineNum);
	};

	onMouseLeaveHoverIcon = lineNum => {
		// lineNum is 0 based
		this.handleUnhighlightLine(lineNum);
		// this.setState({ openPlusOnLine: undefined });
	};

	renderHoverIcons = numLinesVisible => {
		const iconsOnLine = this.mapVisibleRangeToLine(this.state.openPlusOnLine);
		const highlightedLine = this.state.highlightedLine;
		return (
			<div>
				{range(0, numLinesVisible + 1).map(lineNum => {
					const top = (100 * lineNum) / numLinesVisible + "vh";
					const hover = lineNum === highlightedLine || lineNum === iconsOnLine;
					return (
						<div
							onMouseEnter={() => this.onMouseEnterHoverIcon(lineNum)}
							onMouseLeave={() => this.onMouseLeaveHoverIcon(lineNum)}
							className={createClassString("hover-plus", {
								open: lineNum === iconsOnLine,
								hover
							})}
							key={lineNum}
							style={{ top }}
						>
							<Icon
								onClick={e => this.handleClickPlus(e, "comment", lineNum)}
								name="comment"
								title={hover ? "Add Comment" : undefined}
								placement="bottomLeft"
								delay={1}
							/>
							<Icon
								onClick={e => this.handleClickPlus(e, "issue", lineNum)}
								name="issue"
								title={hover ? "Create Issue" : undefined}
								placement="bottomLeft"
								delay={1}
							/>
							<Icon
								onClick={e => this.handleClickPlus(e, "bookmark", lineNum)}
								name="bookmark"
								title={hover ? "Create Bookmark" : undefined}
								placement="bottomLeft"
								delay={1}
							/>
							<Icon
								onClick={e => this.handleClickPlus(e, "link", lineNum)}
								name="link"
								title={hover ? "Get Permalink" : undefined}
								placement="bottomLeft"
								delay={1}
							/>
						</div>
					);
				})}
			</div>
		);
	};

	renderNoCodemarks = () => {
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
				Discuss code with your team by selecting a range and clicking an icon (
				<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Building-a-Knowledge-Base-with-Codemarks">
					show me how
				</a>
				).
			</div>
		);
	};

	getMarkerStartLine = marker => {
		if (marker.range) {
			return marker.range.start.line;
		}

		return marker.locationWhenCreated[0];
	};

	renderInline() {
		const { textEditorVisibleRanges, documentMarkers } = this.props;

		// create a map from start-lines to the codemarks that start on that line
		let docMarkersByStartLine = {};
		documentMarkers.forEach(docMarker => {
			// @ts-ignore
			if (!docMarker.codemark.pinned) return;
			let startLine = Number(this.getMarkerStartLine(docMarker)) - 1;
			// if there is already a codemark on this line, keep skipping to the next one
			while (docMarkersByStartLine[startLine]) startLine++;
			docMarkersByStartLine[startLine] = docMarker;
		});

		const { numLinesVisible } = this.state;

		// console.log("TEVR: ", textEditorVisibleRanges);
		if (documentMarkers.length === 0) {
			return [this.renderHoverIcons(numLinesVisible), this.renderNoCodemarks()];
		}

		const numVisibleRanges =
			textEditorVisibleRanges === undefined ? 0 : textEditorVisibleRanges.length;

		let rangeStartOffset = 0;
		return (
			<div
				className="inline-codemarks vscroll"
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
							let top =
								(100 * (rangeStartOffset + lineNum - realFirstLine)) / numLinesVisible + "vh";
							if (docMarkersByStartLine[lineNum] && lineNum !== this.state.openPlusOnLine + 1) {
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
							let top = (100 * rangeStartOffset) / numLinesVisible + "vh";
							marksInRange.push(<div style={{ top }} className="folded-code-indicator" />);
						}
						return marksInRange;
					})}
				</div>
				{this.renderHoverIcons(numLinesVisible)}
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
				<div className="panel-header">
					<Tooltip title="View As List or Inline" placement="left">
						<label
							className={createClassString("switch", {
								checked: !viewInline
							})}
							onClick={this.toggleViewCodemarksInline}
						/>
					</Tooltip>
					{!viewInline && "Codemarks"}
				</div>
				{this.state.isLoading /* TODO: Create a component for this */ ? (
					<div className="loading-page">
						<div className="loader-ring">
							<div className="loader-ring__segment" />
							<div className="loader-ring__segment" />
							<div className="loader-ring__segment" />
							<div className="loader-ring__segment" />
						</div>
					</div>
				) : viewInline ? (
					this.renderInline()
				) : (
					this.renderList()
				)}
			</div>
		);
	}

	toggleViewCodemarksInline = () => {
		HostApi.instance.send(UpdateConfigurationRequestType, {
			name: "viewCodemarksInline",
			value: !this.props.viewInline
		});
	};

	handleClickPlus = async (event, type, lineNum) => {
		event.preventDefault();
		this.props.setNewPostEntry("Spatial View");

		const { openPlusOnLine } = this.state;
		const { selection } = this.props;

		const mappedLineNum = this.mapLineToVisibleRange(lineNum);

		let range;
		if (
			mappedLineNum === openPlusOnLine &&
			(selection.start.line !== selection.end.line ||
				selection.start.character !== selection.end.character)
		) {
			range = Range.create(selection.start, selection.end);
		} else {
			range = Range.create(mappedLineNum, 0, mappedLineNum, MaxRangeValue);
		}

		const scmInfo = await HostApi.instance.send(GetRangeScmInfoRequestType, {
			uri: this.props.textEditorUri,
			range: range,
			dirty: true // should this be determined here? using true to be safe
		});

		this.props.setMultiCompose(true, {
			quote: scmInfo,
			composeBoxProps: { commentType: type }
		});
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
			// TODO: What should we do if we don't find the marker?
			if (response === undefined) return;

			HostApi.instance.send(EditorRevealRangeRequestType, {
				uri: response.textDocument.uri,
				range: response.range,
				preserveFocus: true
			});
		}
		this.props.setThread(codemark.streamId, codemark.parentPostId || codemark.postId);
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

	mapLineToVisibleRange = fromLineNum => {
		const { textEditorVisibleRanges } = this.props;

		let lineCounter = 0;
		let toLineNum = 0;
		if (textEditorVisibleRanges != null) {
			textEditorVisibleRanges.forEach(lineRange => {
				range(lineRange.start.line, lineRange.end.line + 1).forEach(thisLine => {
					if (++lineCounter === fromLineNum) toLineNum = thisLine;
				});
			});
		}
		return toLineNum;
	};

	// the opposite of mapLineToVisibleRange
	mapVisibleRangeToLine = fromLineNum => {
		const { textEditorVisibleRanges } = this.props;

		let lineCounter = 0;
		let toLineNum = 0;
		if (textEditorVisibleRanges != null) {
			textEditorVisibleRanges.forEach(lineRange => {
				range(lineRange.start.line, lineRange.end.line + 1).forEach(thisLine => {
					lineCounter++;
					if (thisLine === fromLineNum) toLineNum = lineCounter;
				});
			});
		}
		return toLineNum;
	};

	highlightLine(line, highlight) {
		const { openPlusOnLine } = this.state;
		const { selection } = this.props;

		const mappedLineNum = this.mapLineToVisibleRange(line);
		if (
			mappedLineNum === openPlusOnLine &&
			(selection.start.line !== selection.end.line ||
				selection.start.character !== selection.end.character)
		) {
			return;
		}

		HostApi.instance.send(EditorHighlightRangeRequestType, {
			uri: this.props.textEditorUri,
			range: Range.create(mappedLineNum, 0, mappedLineNum, MaxRangeValue),
			highlight: highlight
		});

		this.setState({ highlightedLine: highlight ? line : null });
	}

	handleHighlightLine = line => {
		this.highlightLine(line, true);
	};

	handleUnhighlightLine = line => {
		if (this.props.multiCompose) return; // don't remove highlight if the codemark form is open

		this.highlightLine(line, false);
	};
}

const EMPTY_ARRAY = [];

const mapStateToProps = state => {
	const { capabilities, context, teams, configs, documentMarkers } = state;

	return {
		usernames: userSelectors.getUsernames(state),
		showMarkers: configs.showMarkers,
		team: teams[context.currentTeamId],
		viewInline: configs.viewCodemarksInline,
		fileNameToFilterFor: context.activeFile || context.lastActiveFile,
		textEditorUri: context.textEditorUri,
		documentMarkers: documentMarkers[context.textEditorUri] || EMPTY_ARRAY,
		capabilities
	};
};

export default connect(
	mapStateToProps,
	{ fetchDocumentMarkers, setThread }
)(SimpleInlineCodemarks);
