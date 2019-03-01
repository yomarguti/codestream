import React, { Component } from "react";
import { connect } from "react-redux";
import * as actions from "./actions";
import * as codemarkSelectors from "../store/codemarks/reducer";
import * as userSelectors from "../store/users/reducer";
import Icon from "./Icon";
import Codemark from "./Codemark";
import ScrollBox from "./ScrollBox";
import Tooltip from "./Tooltip";
import createClassString from "classnames";
import { range } from "../utils";
import { HostApi } from "../webview-api";
import {
	ShowCodeRequestType,
	HighlightCodeRequestType,
	HighlightLineRequestType,
	RevealFileLineRequestType,
	StartCommentOnLineRequestType,
	ShowMarkersInEditorRequestType,
	UpdateConfigurationRequestType
} from "../ipc/webview.protocol";
import { TelemetryRequestType } from "@codestream/protocols/agent";

export class SimpleInlineCodemarks extends Component {
	disposables = [];
	editorMarkersEnabled = false;

	constructor(props) {
		super(props);

		this.state = {
			openPost: null
		};
	}

	componentDidMount() {
		HostApi.instance.send(ShowMarkersInEditorRequestType, { enable: this.editorMarkersEnabled });
		this.props.fetchCodemarks();
		// this.disposables.push(
		// 	EventEmitter.subscribe("interaction:active-editor-changed", this.handleFileChangedEvent)
		// );
		this.setVisibleLinesCount();
	}

	componentWillUnmount() {
		HostApi.instance.send(ShowMarkersInEditorRequestType, { enable: true });
		this.disposables.forEach(d => d.dispose());
	}

	handleFileChangedEvent = body => {
		// if (body && body.editor && body.editor.fileName)
		// 	this.setState({ thisFile: body.editor.fileName, thisRepo: body.editor.repoId });
		// else this.setState({ thisFile: null });
	};

	setVisibleLinesCount = () => {
		const { textEditorVisibleRanges = [] } = this.props;

		let numLinesVisible = 0;
		textEditorVisibleRanges.forEach(range => {
			numLinesVisible += range[1].line - range[0].line + 1;
		});
		numLinesVisible += 1; // vscode mis-reports the last line as being 2 bigger than it is

		// only set this if it changes by more than 1. we expect it to vary by 1 as
		// the topmost and bottommost line are revealed and the window is not an integer
		// number of lines high.
		if (Math.abs(numLinesVisible - Number(this.state.numLinesVisible || 0)) > 1) {
			this.setState({ numLinesVisible });
		}
	};

	compareStart(range1 = [], range2 = []) {
		if (range1.length === 0 || range2.length === 0) return true;
		const start1 = range1[0].line;
		const start2 = range2[0].line;
		return start1 === start2;
	}

	componentDidUpdate(prevProps, prevState) {
		const { textEditorVisibleRanges } = this.props;

		const didStartLineChange = this.compareStart(
			textEditorVisibleRanges,
			prevProps.textEditorVisibleRanges
		);

		if (false && textEditorFirstLine !== prevProps.textEditorFirstLine) {
			const top = (textEditorFirstLine === 0 ? 1 : textEditorFirstLine + 0.65) * 18;
			// this._scrollDiv.scrollTop = Math.round(top) + "px";
			this._scrolling = true;
			document.getElementsByClassName("inline-codemarks")[0].scrollTop = Math.round(top);
		}
		if (didStartLineChange) this.setVisibleLinesCount();
	}

	renderList = () => {
		const { codemarks } = this.props;

		if (codemarks.length === 0) return this.renderNoCodemarks();
		else {
			return (
				<ScrollBox>
					<div className="inline-codemarks channel-list vscroll">
						<div
							className={createClassString("section", "has-children", {
								expanded: true
							})}
						>
							<div className="header top" onClick={e => this.toggleSection(e, "unreadChannels")}>
								<Icon name="triangle-right" className="triangle-right" />
								<span>
									In This File: <span className="filename">{this.props.fileNameToFilterFor}</span>
								</span>
							</div>
							{codemarks
								.sort((a, b) => b.createdAt - a.createdAt)
								.map(codemark => {
									if (!codemark.pinned) return null;
									return (
										<Codemark
											key={codemark.id}
											codemark={codemark}
											collapsed={this.state.openPost !== codemark.id}
											inline={false}
											currentUserName={this.props.currentUserName || "pez"}
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
		}
	};

	renderHoverIcons = (numLinesVisible, openPlusOnLine) => {
		return (
			<div>
				{range(0, numLinesVisible + 1).map(lineNum => {
					const top = (100 * lineNum) / numLinesVisible + "vh";
					return (
						<div
							onMouseEnter={() => this.handleHighlightLine(lineNum)}
							onMouseLeave={() => this.handleUnhighlightLine(lineNum)}
							className={createClassString("hover-plus", {
								open: lineNum === openPlusOnLine
							})}
							key={lineNum}
							style={{ top }}
						>
							<Icon
								onClick={e => this.handleClickPlus(e, "comment", lineNum)}
								name="comment"
								xtitle="Add Comment"
								placement="bottomLeft"
								delay="1"
							/>
							<Icon
								onClick={e => this.handleClickPlus(e, "issue", lineNum)}
								name="issue"
								xtitle="Create Issue"
								placement="bottomLeft"
								delay="1"
							/>
							<Icon
								onClick={e => this.handleClickPlus(e, "bookmark", lineNum)}
								name="bookmark"
								xtitle="Create Bookmark"
								placement="bottomLeft"
								delay="1"
							/>
							<Icon
								onClick={e => this.handleClickPlus(e, "link", lineNum)}
								name="link"
								xtitle="Get Permalink"
								placement="bottomLeft"
								delay="1"
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
				<a href="foo">show me how</a>).
			</div>
		);
	};

	renderInline() {
		const {
			codemarks,
			codemarkStartLine,
			textEditorVisibleRanges = [],
			openPlusOnLine
		} = this.props;
		const { numLinesVisible } = this.state;

		// console.log("TEVR: ", textEditorVisibleRanges);
		if (codemarks.length === 0) {
			return [this.renderHoverIcons(numLinesVisible, openPlusOnLine), this.renderNoCodemarks()];
		} else {
			const numVisibleRanges = textEditorVisibleRanges.length;

			let rangeStartOffset = 0;
			return (
				<div
					className="inline-codemarks vscroll"
					onScroll={this.onScroll}
					ref={ref => (this._scrollDiv = ref)}
				>
					<div>
						{textEditorVisibleRanges.map((lineRange, rangeIndex) => {
							const realFirstLine = lineRange[0].line; // == 0 ? 1 : lineRange[0].line;
							const realLastLine = lineRange[1].line;
							const linesInRange = realLastLine - realFirstLine + 1;
							const marksInRange = range(realFirstLine, realLastLine + 1).map(lineNum => {
								let top =
									(100 * (rangeStartOffset + lineNum - realFirstLine)) / numLinesVisible + "vh";
								if (codemarkStartLine[lineNum] && lineNum !== openPlusOnLine) {
									const codemark = codemarkStartLine[lineNum];
									return (
										<Codemark
											key={codemark.id}
											codemark={codemark}
											collapsed={this.state.openPost !== codemark.id}
											inline={true}
											currentUserName={this.props.currentUserName || "pez"}
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
					{this.renderHoverIcons(numLinesVisible, openPlusOnLine)}
				</div>
			);
		}
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
		HostApi.instance.send(RevealFileLineRequestType, { line });
	};

	toggleShowMarkers = () => {
		HostApi.instance.send(TelemetryRequestType, {
			eventName: "Codemarks View Toggled",
			properties: {
				Direction: "List"
			}
		});

		// TODO: test this when it spatial view is enabled
		this.editorMarkersEnabled = !this.editorMarkersEnabled;
		HostApi.instance.send(ShowMarkersInEditorRequestType, {
			enable: this.editorMarkersEnabled
		});
		this.props.setActivePanel("knowledge");
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
				{viewInline ? this.renderInline() : this.renderList()}
			</div>
		);
	}

	toggleViewCodemarksInline = () => {
		HostApi.instance.send(UpdateConfigurationRequestType, {
			name: "viewCodemarksInline",
			value: !this.props.viewInline
		});
	};

	handleClickPlus = (event, type, lineNum) => {
		event.preventDefault();
		this.props.setNewPostEntry("Spatial View");

		const mappedLineNum = this.mapLineToVisibleRange(lineNum + 1);
		HostApi.instance.send(StartCommentOnLineRequestType, {
			line: mappedLineNum,
			uri: this.props.textEditorUri,
			type: type
		});
		setTimeout(() => this.props.focusInput(), 500);
	};

	handleClickCodemark = codemark => {
		HostApi.instance.send(TelemetryRequestType, {
			eventName: "Codemark Clicked",
			properties: {
				"Codemark Location": "Spatial View"
			}
		});
		if (codemark.markers)
			HostApi.instance.send(ShowCodeRequestType, {
				marker: codemark.markers[0],
				enteringThread: true
			});
		this.props.setThread(codemark.streamId, codemark.parentPostId || codemark.postId);
		// const isOpen = this.state.openPost === id;
		// if (isOpen) this.setState({ openPost: null });
		// else {
		// this.setState({ openPost: id });
		// }
	};

	highlightCode(marker, highlight) {
		HostApi.instance.send(HighlightCodeRequestType, {
			uri: this.props.textEditorUri,
			marker: marker,
			highlight: highlight,
			source: "stream"
		});
	}

	handleHighlightCodemark = codemark => {
		if (codemark.markers) this.highlightCode(codemark.markers[0], true);
	};

	handleUnhighlightCodemark = codemark => {
		if (codemark.markers) this.highlightCode(codemark.markers[0], false);
	};

	mapLineToVisibleRange = fromLineNum => {
		const { textEditorVisibleRanges = [] } = this.props;

		let lineCounter = 0;
		let toLineNum = 0;
		textEditorVisibleRanges.forEach(lineRange => {
			range(lineRange[0].line, lineRange[1].line + 1).forEach(thisLine => {
				if (++lineCounter === fromLineNum) toLineNum = thisLine;
			});
		});
		return toLineNum;
	};

	highlightLine(line, highlight) {
		HostApi.instance.send(HighlightLineRequestType, {
			uri: this.props.textEditorUri,
			line: line,
			highlight: highlight,
			source: "stream"
		});
	}

	handleHighlightLine = lineNum => {
		const mappedLineNum = this.mapLineToVisibleRange(lineNum);
		this.highlightLine(mappedLineNum, true);
	};

	handleUnhighlightLine = lineNum => {
		const mappedLineNum = this.mapLineToVisibleRange(lineNum);
		this.highlightLine(mappedLineNum, false);
	};

	toggleStatus = id => {
		this.setState({
			statusPosts: { ...this.state.statusPosts, [id]: !this.state.statusPosts[id] }
		});
	};

	handleClickCreateKnowledge = e => {
		e.stopPropagation();
		this.props.setActivePanel("main");
		setTimeout(() => {
			this.props.runSlashCommand("multi-compose");
		}, 500);
		return;
	};

	handleClickSelectItem = event => {
		event.preventDefault();
		var liDiv = event.target.closest("li");
		if (!liDiv) return; // FIXME throw error
		if (liDiv.id) {
			this.props.setActivePanel("main");
			this.props.setCurrentStream(liDiv.id);
		} else if (liDiv.getAttribute("teammate")) {
			this.props.createStream({ type: "direct", memberIds: [liDiv.getAttribute("teammate")] });
		} else {
			console.log("Unknown LI in handleClickSelectStream: ", event);
		}
	};
}

const mapStateToProps = state => {
	const { capabilities, context, teams, configs } = state;

	const codemarks = codemarkSelectors.getFileFilteredCodemarks(state);

	const getCodemarkStartLine = codemark => {
		if (!codemark.markers || codemark.markers.length === 0) return 1;
		const marker = codemark.markers[0];
		const location = marker.location || marker.locationWhenCreated;
		return location[0];
	};

	// create a map from start-lines to the codemarks that start on that line
	let codemarkStartLine = {};
	codemarks.forEach(codemark => {
		if (!codemark.pinned) return;
		let startLine = Number(getCodemarkStartLine(codemark)) - 1;
		// if there is already a codemark on this line, keep skipping to the next one
		while (codemarkStartLine[startLine]) startLine++;
		codemarkStartLine[startLine] = codemark;
	});

	return {
		usernames: userSelectors.getUsernames(state),
		codemarks,
		codemarkStartLine,
		showMarkers: configs.showMarkers,
		team: teams[context.currentTeamId],
		fileFilter: context.codemarkFileFilter,
		viewInline: configs.viewCodemarksInline,
		fileNameToFilterFor: context.activeFile || context.lastActiveFile,
		capabilities
	};
};

export default connect(
	mapStateToProps,
	actions
)(SimpleInlineCodemarks);
