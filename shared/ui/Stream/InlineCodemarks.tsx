import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import * as userSelectors from "../store/users/reducer";
import Icon from "./Icon";
import Codemark from "./Codemark";
import ScrollBox from "./ScrollBox";
import Feedback from "./Feedback";
import cx from "classnames";
import { range, debounceToAnimationFrame } from "../utils";
import { HostApi } from "../webview-api";
import {
	EditorHighlightRangeRequestType,
	EditorRevealRangeRequestType,
	EditorSelectRangeRequestType,
	MaxRangeValue,
	EditorSelection,
	EditorMetrics,
	EditorContext,
	WebviewConfigs,
	ShowCodemarkNotificationType
} from "../ipc/webview.protocol";
import {
	DocumentMarker,
	TelemetryRequestType,
	DidChangeDocumentMarkersNotificationType,
	GetDocumentFromMarkerRequestType
} from "@codestream/protocols/agent";
import { Range, Position } from "vscode-languageserver-types";
import { fetchDocumentMarkers } from "../store/documentMarkers/actions";
import {
	getCurrentSelection,
	getVisibleLineCount,
	getVisibleRanges,
	getLine0ForEditorLine
} from "../store/editorContext/reducer";
import { CSTeam, CSUser } from "@codestream/protocols/api";
import {
	setCodemarksFileViewStyle,
	setCodemarksShowArchived,
	setCodemarksShowResolved
} from "../store/context/actions";
import { State as ContextState } from "../store/context/types";
import { sortBy as _sortBy } from "lodash-es";
import { getTeamMembers } from "../store/users/reducer";
import { getCodemark } from "../store/codemarks/reducer";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//   Note that there is a big potential for off-by-one errors in this file, because the webview line numbers are
//   0-based, and the linenumbers in the editor are 1-based. I've tried to make it more clear which is which by
//   naming the 0-based line number variables with a "0" at the end, for example line0 or lineNum0. Hopefully
//   this helps avoid some confusion... please stick with this paradigm unless you really hate it, in which case
//   please talk to me first. Thanks. -Pez
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

interface Props {
	currentStreamId?: string;
	teammates?: CSUser[];
	usernames: string[];
	team: CSTeam;
	viewInline: boolean;
	viewHeadshots: boolean;
	showLabelText: boolean;
	showClosed: boolean;
	showUnpinned: boolean;
	fileNameToFilterFor?: string;
	textEditorUri?: string;
	textEditorLineCount: number;
	firstVisibleLine: number;
	lastVisibleLine: number;
	numLinesVisible: number;
	textEditorVisibleRanges?: Range[];
	textEditorSelection?: EditorSelection;
	metrics?: EditorMetrics;
	documentMarkers: DocumentMarker[];
	numUnpinned: number;
	numClosed: number;
	isSlackTeam: boolean;

	fetchDocumentMarkers: (
		...args: Parameters<typeof fetchDocumentMarkers>
	) => ReturnType<ReturnType<typeof fetchDocumentMarkers>>;
	postAction(): void;
	setCodemarksFileViewStyle: (
		...args: Parameters<typeof setCodemarksFileViewStyle>
	) => ReturnType<typeof setCodemarksFileViewStyle>;
	setCodemarksShowArchived: (
		...args: Parameters<typeof setCodemarksShowArchived>
	) => ReturnType<typeof setCodemarksShowArchived>;
	setCodemarksShowResolved: (
		...args: Parameters<typeof setCodemarksShowResolved>
	) => ReturnType<typeof setCodemarksShowResolved>;
	setMultiCompose(...args: any[]): void;
	setNewPostEntry(a: string): void;
}

interface State {
	lastSelectedLine: number;
	clickedPlus: boolean;
	isLoading: boolean;
	selectedDocMarkerId: string | undefined;
	openIconsOnLine: number;
	query: string | undefined;
	highlightedLine?: number;
	rippledLine?: number;
	numAbove: number;
	numBelow: number;
	highlightedDocmarker: string | undefined;
}

export class SimpleInlineCodemarks extends Component<Props, State> {
	static contextTypes = {
		store: PropTypes.object
	};

	disposables: { dispose(): void }[] = [];
	titles: {
		comment: JSX.Element;
		bookmark: JSX.Element;
		link: JSX.Element;
		issue: JSX.Element;
		about: JSX.Element;
	};
	docMarkersByStartLine: {};
	_scrollDiv: HTMLDivElement | null | undefined;
	private root = React.createRef<HTMLDivElement>();
	hiddenCodemarks = {};

	constructor(props: Props) {
		super(props);

		this.state = {
			isLoading: props.documentMarkers.length === 0,
			lastSelectedLine: 0,
			clickedPlus: false,
			selectedDocMarkerId: undefined,
			query: undefined,
			openIconsOnLine: -1,
			numAbove: 0,
			numBelow: 0,
			highlightedDocmarker: undefined
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
			),
			about: (
				<span>
					Get Info<span className="keybinding extra-pad">{modifier}</span>
					<span className="keybinding">a</span>
				</span>
			)
		};
		this.docMarkersByStartLine = {};
	}

	static getDerivedStateFromProps(props: Props, state: State) {
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
		const mutationObserver = new MutationObserver(() => this.repositionCodemarks());
		mutationObserver.observe(document.getElementById("stream-root")!, {
			childList: true,
			subtree: true
		});

		this.disposables.push(
			HostApi.instance.on(DidChangeDocumentMarkersNotificationType, ({ textDocument }) => {
				if (this.props.textEditorUri === textDocument.uri) {
					this.props.fetchDocumentMarkers(textDocument.uri);
				}
			}),
			HostApi.instance.on(ShowCodemarkNotificationType, e => {
				const { codemarks } = this.context.store.getState();

				const codemark = getCodemark(codemarks, e.codemarkId);
				if (codemark == null) return;

				if (codemark.markers != null && codemark.markers.length !== 0) {
					this.setState({ selectedDocMarkerId: codemark.markers[0].id });
				}
			}),
			{
				dispose() {
					mutationObserver.disconnect();
				}
			}
		);

		if (this.props.textEditorUri) {
			this.props.fetchDocumentMarkers(this.props.textEditorUri).then(() => {
				this.setState(state => (state.isLoading ? { isLoading: false } : null));
			});
		}

		this.scrollTo(18);
	}

	componentDidUpdate(prevProps: Props) {
		const { textEditorUri } = this.props;
		if (String(textEditorUri).length > 0 && prevProps.textEditorUri !== textEditorUri) {
			this.onFileChanged();
		}

		const didStartLineChange = this.compareStart(
			this.props.textEditorVisibleRanges,
			prevProps.textEditorVisibleRanges
		);
		if (didStartLineChange) {
			this.scrollTo(18);
		}

		this.repositionCodemarks();
	}

	private repositionTimeout: any | undefined;

	componentWillUnmount() {
		this.disposables.forEach(d => d.dispose());
		if (this.repositionTimeout) clearTimeout(this.repositionTimeout);
	}

	scrollTo(top) {
		const $div = document.getElementById("inline-codemarks-scroll-container");
		if ($div) {
			$div.scrollTop = top;
		}
	}

	repositionAbove() {}

	repositionBelow() {}

	repositionCodemarks = debounceToAnimationFrame(() => {
		let $codemarkDivs = Array.from(
			document.querySelectorAll(".codemark.inline:not(.hidden), .compose.float-compose")
		);
		this.repositionElements($codemarkDivs);
		let $hiddenDivs = Array.from(document.querySelectorAll(".codemark.inline.hidden"));
		this.repositionElements($hiddenDivs);
	});

	repositionElements = $elements => {
		$elements.sort((a, b) => a.dataset.top - b.dataset.top);
		// const $composeDiv = document.getElementsByClassName("compose float-compose");

		let bottomOfLastDiv = -30;
		// let runningYAdjustment = 0;
		for (let $element of $elements) {
			const domRect = $element.getBoundingClientRect();
			const origTop = parseInt($element.dataset.top, 10);
			const yDiff = bottomOfLastDiv - origTop + 20;
			const height = domRect.bottom - domRect.top;

			// const origMargin = parseInt($element.style.marginTop, 10) || 0;
			if (yDiff > 0) {
				$element.style.marginTop = yDiff + "px";
				bottomOfLastDiv = origTop + height + yDiff;
			} else {
				$element.style.marginTop = "0";
				bottomOfLastDiv = origTop + height;
			}
		}
	};

	async onFileChanged() {
		const { textEditorUri, documentMarkers } = this.props;
		if (textEditorUri && documentMarkers.length === 0) {
			this.setState(state => (state.isLoading ? null : { isLoading: true }));

			await this.props.fetchDocumentMarkers(textEditorUri!);
			this.setState(state => (state.isLoading ? { isLoading: false } : null));
		}
	}

	compareStart(range1?: Range[], range2?: Range[]) {
		if (range1 == null || range1.length === 0 || range2 == null || range2.length === 0) return true;
		const start1 = range1[0].start.line;
		const start2 = range2[0].start.line;
		return start1 !== start2;
	}

	renderList = (paddingTop, fontSize, height) => {
		const { documentMarkers, showUnpinned, showClosed } = this.props;
		const { selectedDocMarkerId } = this.state;

		this.hiddenCodemarks = {};
		return [
			<div
				id="inline-codemarks-field"
				style={{
					top: paddingTop,
					// purple background for debugging purposes
					// background: "#333366",
					fontSize: fontSize,
					position: "fixed",
					left: 0,
					height: height,
					width: "45px",
					zIndex: 5000
				}}
			>
				<div style={{ position: "relative", background: "red" }}>
					{this.renderHoverIcons(this.props.numLinesVisible)}
				</div>
			</div>,
			<div style={{ height: "100%", paddingTop: "55px" }}>
				<ScrollBox>
					<div
						className="channel-list vscroll"
						onClick={this.handleClickField}
						id="inline-codemarks-scroll-container"
						style={{ paddingTop: "20px", fontSize: fontSize }}
					>
						{this.props.children}
						{documentMarkers
							.sort(
								(a, b) =>
									this.getMarkerStartLine(a) - this.getMarkerStartLine(b) ||
									a.createdAt - b.createdAt
							)
							.map(docMarker => {
								const { codemark } = docMarker;
								// @ts-ignore
								//if (!codemark.pinned && !showUnpinned) return null;
								// if (codemark.type === "issue" && codemark.status === "closed" && !showClosed)
								// return null;
								const hidden =
									(!codemark.pinned && !showUnpinned) ||
									(codemark.type === "issue" && codemark.status === "closed" && !showClosed);
								if (hidden) {
									this.hiddenCodemarks[docMarker.id] = true;
									return null;
								}
								return (
									<Codemark
										key={codemark.id}
										// @ts-ignore
										codemark={docMarker.codemark}
										marker={docMarker}
										collapsed={true}
										inline={true}
										hidden={hidden}
										teammates={this.props.teammates}
										isSlackTeam={this.props.isSlackTeam}
										hover={this.state.highlightedDocmarker === docMarker.id}
										selected={selectedDocMarkerId === docMarker.id}
										usernames={this.props.usernames}
										onClick={this.handleClickCodemark}
										onMouseEnter={this.handleHighlightCodemark}
										onMouseLeave={this.handleUnhighlightCodemark}
										action={this.props.postAction}
										query={this.state.query}
										viewHeadshots={this.props.viewHeadshots}
										postAction={this.props.postAction}
										style={{ position: "relative", marginBottom: "20px" }}
									/>
								);
							})}
					</div>
				</ScrollBox>
			</div>
		];
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
		// if the compose box is open, don't show hover icons
		if (this.props.children) return null;

		// we only add the title properties (which add tooltips)
		// when you mouse over them for performance reasons. adding
		// tool tips on each one slowed things down a lot. -Pez
		return (
			<div
				onMouseEnter={() => this.onMouseEnterHoverIcon(lineNum0)}
				onMouseLeave={() => this.onMouseLeaveHoverIcon(lineNum0)}
				className={cx("hover-plus", { open, hover })}
				key={lineNum0}
				style={{ top }}
			>
				{(hover || open) && [
					<Icon
						onClick={e => this.handleClickPlus(e, "comment", lineNum0, top)}
						name="comment"
						title={this.titles.comment}
						placement="bottomLeft"
						align={{ offset: [-3, 10] }}
						delay={1}
					/>,
					<Icon
						onClick={e => this.handleClickPlus(e, "issue", lineNum0, top)}
						name="issue"
						title={this.titles.issue}
						placement="bottomLeft"
						align={{ offset: [-3, 10] }}
						delay={1}
					/>,
					<Icon
						onClick={e => this.handleClickPlus(e, "bookmark", lineNum0, top)}
						name="bookmark"
						title={this.titles.bookmark}
						placement="bottomLeft"
						align={{ offset: [-3, 10] }}
						delay={1}
					/>,
					// <Icon
					// 	onClick={e => this.handleClickPlus(e, "about", lineNum0, top)}
					// 	name="about"
					// 	title={this.titles.about}
					// 	placement="bottomLeft"
					// 	align={{ offset: [-3, 10] }}
					// 	delay={1}
					// />,
					<Icon
						onClick={e => this.handleClickPlus(e, "link", lineNum0, top)}
						name="link"
						title={this.titles.link}
						placement="bottomLeft"
						align={{ offset: [-3, 10] }}
						delay={1}
					/>
				]}
			</div>
		);
	}

	codeHeight = () => {
		const $field = document.getElementById("inline-codemarks-field") as HTMLDivElement;
		return $field ? $field.offsetHeight : 100;
	};

	rippleHoverIcons = lineNum => {
		const { firstVisibleLine, lastVisibleLine } = this.props;

		if (lineNum === undefined) {
			// start the ripple
			this.rippleHoverIcons(firstVisibleLine);
		} else if (lineNum > lastVisibleLine) {
			// we're done with the ripple
			this.setState({ rippledLine: undefined });
		} else {
			// set the current line active, and set a timeout
			// to ripple to the next line
			setTimeout(() => {
				this.setState({ rippledLine: lineNum });
				this.rippleHoverIcons(lineNum + 1);
			}, 5);
		}
	};

	renderHoverIcons = numLinesVisible => {
		const iconsOnLine0 = getLine0ForEditorLine(
			this.props.textEditorVisibleRanges,
			this.state.openIconsOnLine
		);
		// console.log("IOL IS: ", iconsOnLine0, " FROM: ", this.state.openIconsOnLine);
		const { highlightedLine, rippledLine } = this.state;

		const codeHeight = this.codeHeight();
		if (iconsOnLine0 >= 0) {
			const top = (codeHeight * iconsOnLine0) / numLinesVisible;
			// const top = paddingTop ? "calc(" + topPct + " + " + paddingTop + "px)" : topPct;
			return this.renderIconRow(iconsOnLine0, top, false, true);
		} else {
			// const heightPerLine = (window.innerHeight - 22) / (numLinesVisible + 2);
			return (
				<div>
					{range(0, numLinesVisible).map(lineNum0 => {
						const top = (codeHeight * lineNum0) / numLinesVisible;
						// const top = paddingTop ? "calc(" + topPct + " + " + paddingTop + "px)" : topPct;
						const hover = lineNum0 === highlightedLine;
						const open = lineNum0 === rippledLine;
						return this.renderIconRow(lineNum0, top, hover, open);
					})}
					{
						// <div style={{ position: "fixed", bottom: "30px", right: "20px", whiteSpace: "pre" }}>
						// {JSON.stringify(metrics)} height: {heightPerLine} numVisible: {numLinesVisible}
						// </div>
					}
				</div>
			);
		}
	};

	renderNoCodemarks = () => {
		const { fileNameToFilterFor, viewInline } = this.props;

		if (fileNameToFilterFor && fileNameToFilterFor.length) {
			return (
				<div key="no-codemarks" className="no-codemarks">
					There are no codemarks
					<Icon
						title="A codemark is a link between a block of code and a conversation, an issue, or a bookmark. Codemarks work across branches, and stay pinned to the block of code even as your codebase changes."
						placement="top"
						className="superscript"
						name="info"
					/>{" "}
					in <b>{this.props.fileNameToFilterFor}</b>
					<br />
					<br />
					Discuss code with your team by selecting a range and clicking an icon (
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

	renderCodemarks() {
		const { viewInline } = this.props;
		const {
			textEditorVisibleRanges = [],
			textEditorLineCount,
			lastVisibleLine,
			numLinesVisible,
			documentMarkers,
			metrics
		} = this.props;

		const numVisibleRanges = textEditorVisibleRanges.length;

		const fontSize = metrics && metrics.fontSize ? metrics.fontSize : "12px";

		const paddingTop = (metrics && metrics.margins && metrics.margins.top) || 0;
		// we add two here because the editor only reports *entirely* visible lines,
		// so there could theoretically be one line that is 99% visible at the top,
		// and also one line that is 99% visible at the bottom, both at the same time.
		const heightPerLine = (window.innerHeight - paddingTop) / (numLinesVisible + 2);
		const expectedLineHeight = ((metrics && metrics.fontSize) || 12) * 1.5;

		// here we have to decide whether we think the editor window is "full of code"
		// in which case we want the height of inlinecodemarks to be 100% minus any
		// padding, or whether the editor window is not full of code, in which case
		// we want to approximate the height of inlinecodemarks to be less than 100%,
		// and instead based on the number of lines visible. this latter case happens
		// when you are editing a small file with not enough lines to fill up the
		// editor, or in the case of vscode when, like a fucking idiot, it lets you
		// scroll the end of the file up to the top of the pane for some brain-dead
		// stupid asenine ridiculous totally useless reason.
		const lastRange = textEditorVisibleRanges[numVisibleRanges - 1];
		const isLastLineVisible = lastRange ? textEditorLineCount <= lastVisibleLine + 1 : false;
		const lessThanFull = heightPerLine > expectedLineHeight && isLastLineVisible;
		const height = lessThanFull
			? expectedLineHeight * numLinesVisible + paddingTop + "px"
			: "calc(100vh - " + paddingTop + "px)";
		// console.log("HEIGHT IS: ", height, " because ", lessThanFull);
		const divStyle = {
			top: paddingTop,
			// background: "#333366",
			position: "relative",
			fontSize: fontSize,
			height: height
		};

		if (documentMarkers.length === 0) {
			if (this.state.numAbove) this.setState({ numAbove: 0 });
			if (this.state.numBelow) this.setState({ numBelow: 0 });
			return (
				<div
					id="inline-codemarks-field"
					style={{
						top: paddingTop,
						// purple background for debugging purposes
						// background: "#333366",
						position: "relative",
						fontSize: fontSize,
						height: height
					}}
				>
					{this.renderHoverIcons(numLinesVisible)}
					{this.renderNoCodemarks()}
					{this.props.children}
				</div>
			);
		}
		return viewInline
			? this.renderInline(paddingTop, fontSize, height)
			: this.renderList(paddingTop, fontSize, height);
	}

	renderInline(paddingTop, fontSize, height) {
		const {
			textEditorVisibleRanges = [],
			firstVisibleLine,
			lastVisibleLine,
			numLinesVisible,
			documentMarkers,
			showUnpinned,
			showClosed
		} = this.props;
		const { selectedDocMarkerId } = this.state;

		const numVisibleRanges = textEditorVisibleRanges.length;
		let numAbove = 0,
			numBelow = 0;
		// create a map from start-lines to the codemarks that start on that line
		this.docMarkersByStartLine = {};
		this.hiddenCodemarks = {};
		documentMarkers.forEach(docMarker => {
			const codemark = docMarker.codemark;
			// @ts-ignore
			let startLine = Number(this.getMarkerStartLine(docMarker));
			// if there is already a codemark on this line, keep skipping to the next one
			while (this.docMarkersByStartLine[startLine]) startLine++;
			this.docMarkersByStartLine[startLine] = docMarker;
			if (
				(!codemark.pinned && !showUnpinned) ||
				(codemark.type === "issue" && codemark.status === "closed" && !showClosed)
			) {
				this.hiddenCodemarks[docMarker.id] = true;
			} else {
				if (startLine < firstVisibleLine) numAbove++;
				if (startLine > lastVisibleLine) numBelow++;
			}
		});

		if (numAbove != this.state.numAbove) this.setState({ numAbove });
		if (numBelow != this.state.numBelow) this.setState({ numBelow });

		const codeHeight = this.codeHeight();
		let rangeStartOffset = 0;
		return (
			<div
				style={{ height: "100vh" }}
				onWheel={this.onWheel}
				id="inline-codemarks-scroll-container"
				ref={ref => (this._scrollDiv = ref)}
				onClick={this.handleClickField}
				data-scrollable="true"
			>
				<div style={{ padding: "18px 0", margin: "-18px 0" }}>
					<div
						style={{
							top: paddingTop,
							// purple background for debugging purposes
							// background: "#333366",
							position: "relative",
							fontSize: fontSize,
							height: height
						}}
						id="inline-codemarks-field"
					>
						<div className="inline-codemarks vscroll-x">
							{this.props.children}
							{(textEditorVisibleRanges || []).map((lineRange, rangeIndex) => {
								const realFirstLine = lineRange.start.line; // == 0 ? 1 : lineRange[0].line;
								const realLastLine = lineRange.end.line;
								const linesInRange = realLastLine - realFirstLine + 1;
								const marksInRange = range(realFirstLine, realLastLine + 1).map(lineNum => {
									const top =
										(codeHeight * (rangeStartOffset + lineNum - realFirstLine)) / numLinesVisible;
									if (this.docMarkersByStartLine[lineNum]) {
										//} && lineNum !== this.state.openIconsOnLine) {
										const docMarker = this.docMarkersByStartLine[lineNum];
										const codemark = docMarker.codemark;
										const hidden = this.hiddenCodemarks[docMarker.id] ? true : false;
										return (
											<Codemark
												key={docMarker.id}
												codemark={codemark}
												marker={docMarker}
												collapsed={true}
												inline={true}
												hidden={hidden}
												teammates={this.props.teammates}
												isSlackTeam={this.props.isSlackTeam}
												hover={this.state.highlightedDocmarker === docMarker.id}
												selected={selectedDocMarkerId === docMarker.id}
												deselectCodemarks={this.deselectCodemarks}
												usernames={this.props.usernames}
												onClick={this.handleClickCodemark}
												onMouseEnter={this.handleHighlightCodemark}
												onMouseLeave={this.handleUnhighlightCodemark}
												action={this.props.postAction}
												query={this.state.query}
												lineNum={lineNum}
												postAction={this.props.postAction}
												style={{ top: top + "px" }}
												top={top}
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
			</div>
		);
	}

	private _clearWheelingStateTimeout?: any;
	private _wheelingState: { accumulatedPixels: number; topLine: number } | undefined;

	onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
		if (event.deltaY === 0) return;

		if (this._clearWheelingStateTimeout !== undefined) {
			clearTimeout(this._clearWheelingStateTimeout);
			this._clearWheelingStateTimeout = undefined;
		}

		// Find the nearest scrollable element and if its not the container we expect, kick out
		const scroller = (event.target as HTMLElement).closest("[data-scrollable]");
		if (
			scroller == null ||
			(scroller.id !== "inline-codemarks-scroll-container" &&
				scroller.scrollHeight > scroller.clientHeight)
		) {
			this._wheelingState = undefined;

			return;
		}

		// Keep track of the "editor" top line, since these events will be too fast for the editor and our eventing to keep up
		if (this._wheelingState === undefined) {
			const { textEditorVisibleRanges } = this.props;
			if (textEditorVisibleRanges == null) return;

			this._wheelingState = {
				accumulatedPixels: 0,
				topLine: textEditorVisibleRanges[0].start.line
			};
		}

		// We only want to accumulate data while the user is actively scrolling, if they pause reset everything
		this._clearWheelingStateTimeout = setTimeout(() => (this._wheelingState = undefined), 500);

		let lines = 0;
		switch (event.deltaMode) {
			case 0: // deltaY is in pixels
				// TODO: Needs to be using editor metrics or calculated from the font size
				const lineHeight = 18;

				const pixels = this._wheelingState.accumulatedPixels + event.deltaY;
				this._wheelingState.accumulatedPixels = pixels % lineHeight;
				lines = pixels < 0 ? Math.ceil(pixels / lineHeight) : Math.floor(pixels / lineHeight);

				break;
			case 1: // deltaY is in lines
				lines = event.deltaY;

				break;
			case 2: // deltaY is in pages
				// Not sure how to handle it, nor is it worth the time
				debugger;

				break;
		}

		if (lines === 0) return;

		let topLine;
		if (event.deltaY < 0) {
			topLine = Math.max(0, this._wheelingState.topLine + lines);
		} else {
			topLine = Math.min(this.props.textEditorLineCount, this._wheelingState.topLine + lines);
		}

		if (topLine === this._wheelingState.topLine) return;

		// Update our tracking as the events will be too slow
		this._wheelingState.topLine = topLine;

		HostApi.instance.send(EditorRevealRangeRequestType, {
			uri: this.props.textEditorUri!,
			range: Range.create(topLine, 0, topLine, 0),
			preserveFocus: true,
			atTop: true
		});
	};

	printViewSelectors() {
		const { numClosed, numUnpinned, viewInline } = this.props;
		const { numAbove, numBelow } = this.state;
		return (
			<div className="view-selectors">
				{viewInline && numAbove > 0 && (
					<span className="count" onClick={this.showAbove}>
						{numAbove} <Icon name="arrow-up" />
					</span>
				)}
				{viewInline && numBelow > 0 && (
					<span className="count" onClick={this.showBelow}>
						{numBelow} <Icon name="arrow-down" />
					</span>
				)}
				{numClosed > 0 && (
					<span className="count" onClick={this.toggleShowClosed}>
						{numClosed} resolved
						<label className={cx("switch", { checked: this.props.showClosed })} />
					</span>
				)}
				{numUnpinned > 0 && (
					<span className="count" onClick={this.toggleShowUnpinned}>
						{numUnpinned} archived
						<label className={cx("switch", { checked: this.props.showUnpinned })} />
					</span>
				)}
				<span className="count" onClick={this.toggleViewCodemarksInline}>
					list
					<label className={cx("switch ", { checked: !viewInline })} />
				</span>
				<Feedback />
			</div>
		);
	}

	render() {
		const { viewInline } = this.props;

		return (
			<div ref={this.root} className={cx("panel inline-panel full-height")}>
				{this.state.isLoading ? null : this.renderCodemarks()}
				{this.printViewSelectors()}
			</div>
		);
	}

	clearSelection = () => {
		const { textEditorSelection } = this.props;
		if (
			textEditorSelection &&
			(textEditorSelection.start.line !== textEditorSelection.end.line ||
				textEditorSelection.start.character !== textEditorSelection.end.character)
		) {
			const position = Position.create(
				textEditorSelection.cursor.line,
				textEditorSelection.cursor.character
			);
			const range = Range.create(position, position);
			HostApi.instance.send(EditorSelectRangeRequestType, {
				uri: this.props.textEditorUri!,
				selection: { ...range, cursor: range.end },
				preserveFocus: true
			});
			// just short-circuits the round-trip to the editor
			this.setState({ openIconsOnLine: -1 });
		}
	};

	handleClickField = (event: React.SyntheticEvent<HTMLDivElement>) => {
		if (event && event.target) {
			const id = (event.target as any).id;
			if (id === "inline-codemarks-scroll-container" || id === "inline-codemarks-field") {
				this.deselectCodemarks();
			}
		}
	};

	deselectCodemarks = () => {
		this.setState(state => (state.selectedDocMarkerId ? { selectedDocMarkerId: undefined } : null));
		this.clearSelection();
	};

	toggleViewCodemarksInline = () => {
		this.props.setCodemarksFileViewStyle(this.props.viewInline ? "list" : "inline");
	};

	toggleShowUnpinned = () => {
		this.props.setCodemarksShowArchived(!this.props.showUnpinned);
	};

	toggleShowClosed = () => {
		this.props.setCodemarksShowResolved(!this.props.showClosed);
	};

	showAbove = () => {
		const { firstVisibleLine } = this.props;

		let done = false;
		Object.keys(this.docMarkersByStartLine)
			.sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
			.reverse()
			.forEach(line => {
				const lineNum = parseInt(line, 10) - 1;
				if (
					!done &&
					lineNum < firstVisibleLine &&
					!this.hiddenCodemarks[this.docMarkersByStartLine[line].id]
				) {
					HostApi.instance.send(EditorRevealRangeRequestType, {
						uri: this.props.textEditorUri!,
						range: Range.create(lineNum, 0, lineNum, 0),
						preserveFocus: true,
						atTop: true
					});
					done = true;
				}
			});
	};

	showBelow = () => {
		const { lastVisibleLine, textEditorUri } = this.props;

		let done = false;
		Object.keys(this.docMarkersByStartLine)
			.sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
			.forEach(line => {
				const lineNum = parseInt(line, 10) + 1;
				if (
					!done &&
					lineNum > lastVisibleLine &&
					!this.hiddenCodemarks[this.docMarkersByStartLine[line].id]
				) {
					HostApi.instance.send(EditorRevealRangeRequestType, {
						uri: textEditorUri!,
						range: Range.create(lineNum, 0, lineNum, 0),
						preserveFocus: true
					});
					done = true;
				}
			});
	};

	handleClickPlus = async (event, type, lineNum0, top) => {
		event.preventDefault();
		this.props.setNewPostEntry("Spatial View");

		const { openIconsOnLine } = this.state;
		const { textEditorSelection } = this.props;

		const mappedLineNum = this.mapLine0ToVisibleRange(lineNum0);

		let range: Range | undefined;
		let setSelection = false;
		if (
			mappedLineNum === openIconsOnLine &&
			textEditorSelection &&
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
			{ commentType: type, top: top },
			{ uri: this.props.textEditorUri, range: range, setSelection: setSelection }
		);
		// setTimeout(() => this.props.focusInput(), 500);
	};

	handleClickCodemark = async (event, codemark, docMarker) => {
		HostApi.instance.send(TelemetryRequestType, {
			eventName: "Codemark Clicked",
			properties: {
				"Codemark Location": "Spatial View"
			}
		});

		if (
			event.target &&
			(event.target.classList.contains("info") || event.target.closest(".info"))
		) {
			return;
		}

		if (
			this.state.selectedDocMarkerId === docMarker.id &&
			event.target &&
			(event.target.classList.contains("author") || event.target.closest(".author"))
		) {
			return this.deselectCodemarks();
		}

		let markerId;
		if (codemark.markers) {
			markerId = codemark.markers[0].id;
		} else if (codemark.markerIds) {
			markerId = codemark.markerIds[0];
		}

		if (markerId) {
			try {
				const response = await HostApi.instance.send(GetDocumentFromMarkerRequestType, {
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
			} catch (error) {
				// TODO:
			}
		}
		this.setState({ selectedDocMarkerId: docMarker.id });
		this.clearSelection();
	};

	async highlightCode(marker, highlight) {
		let range = marker.range;
		if (!range) {
			const response = await HostApi.instance.send(GetDocumentFromMarkerRequestType, {
				markerId: marker.id
			});
			// TODO: What should we do if we don't find the marker?
			if (response === undefined) return;

			range = response.range;
		}

		HostApi.instance.send(EditorHighlightRangeRequestType, {
			uri: this.props.textEditorUri!,
			range: range,
			highlight: highlight
		});
	}

	handleHighlightCodemark = marker => {
		this.setState({ highlightedDocmarker: marker.id });
		this.highlightCode(marker, true);
	};

	handleUnhighlightCodemark = marker => {
		this.setState({ highlightedDocmarker: undefined });
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

	highlightLine(line0, highlight) {
		const { openIconsOnLine } = this.state;
		const { textEditorSelection } = this.props;

		const mappedLineNum = this.mapLine0ToVisibleRange(line0);
		if (
			mappedLineNum === openIconsOnLine &&
			textEditorSelection &&
			(textEditorSelection.start.line !== textEditorSelection.end.line ||
				textEditorSelection.start.character !== textEditorSelection.end.character)
		) {
			return;
		}

		HostApi.instance.send(EditorHighlightRangeRequestType, {
			uri: this.props.textEditorUri!,
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

const mapStateToProps = (state: {
	configs: WebviewConfigs;
	context: ContextState;
	documentMarkers: { [uri: string]: any };
	editorContext: EditorContext;
	teams: { [id: string]: any };
	users: any;
}) => {
	const { context, editorContext, teams, users, configs, documentMarkers } = state;

	const teamMembers = getTeamMembers(state);

	const docMarkers = documentMarkers[editorContext.textEditorUri || ""] || EMPTY_ARRAY;
	const numUnpinned = docMarkers.filter(d => !d.codemark.pinned).length;
	const numClosed = docMarkers.filter(d => d.codemark.status === "closed").length;

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
		currentStreamId: context.currentStreamId,
		usernames: userSelectors.getUsernames(state),
		teammates: teamMembers,
		team: teams[context.currentTeamId],
		viewInline: context.codemarksFileViewStyle === "inline",
		viewHeadshots: configs.showHeadshots,
		showLabelText: false, //configs.showLabelText,
		showClosed: context.codemarksShowResolved || false,
		showUnpinned: context.codemarksShowArchived || false,
		fileNameToFilterFor: editorContext.activeFile || editorContext.lastActiveFile,
		textEditorUri: editorContext.textEditorUri,
		textEditorLineCount: editorContext.textEditorLineCount || 0,
		firstVisibleLine,
		lastVisibleLine,
		textEditorVisibleRanges,
		textEditorSelection: getCurrentSelection(editorContext),
		metrics: editorContext.metrics,
		documentMarkers: docMarkers,
		numLinesVisible: getVisibleLineCount(textEditorVisibleRanges),
		numUnpinned,
		numClosed
	};
};

export default connect(
	mapStateToProps,
	{
		fetchDocumentMarkers,
		setCodemarksFileViewStyle,
		setCodemarksShowArchived,
		setCodemarksShowResolved
	}
)(SimpleInlineCodemarks);
