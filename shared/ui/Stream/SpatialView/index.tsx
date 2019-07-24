import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect, batch } from "react-redux";
import cx from "classnames";
import * as userSelectors from "@codestream/webview/store/users/reducer";
import Icon from "../Icon";
import { Codemark } from "./Codemark";
import ScrollBox from "../ScrollBox";
import Tooltip from "../Tooltip"; // careful with tooltips on codemarks; they are not performant
import Feedback from "../Feedback";
import {
	range,
	debounceToAnimationFrame,
	isNotOnDisk,
	shortUuid,
	areRangesEqual
} from "@codestream/webview/utils";
import { HostApi } from "@codestream/webview/webview-api";
import {
	EditorHighlightRangeRequestType,
	EditorRevealRangeRequestType,
	EditorSelectRangeRequestType,
	MaxRangeValue,
	EditorSelection,
	EditorMetrics,
	EditorScrollToNotificationType,
	EditorScrollMode
} from "@codestream/webview/ipc/webview.protocol";
import {
	DocumentMarker,
	TelemetryRequestType,
	DidChangeDocumentMarkersNotificationType,
	GetDocumentFromMarkerRequestType,
	GetFileScmInfoResponse,
	GetFileScmInfoRequestType,
	CodemarkPlus
} from "@codestream/protocols/agent";
import { Range, Position } from "vscode-languageserver-types";
import {
	fetchDocumentMarkers,
	saveDocumentMarkers
} from "@codestream/webview/store/documentMarkers/actions";
import {
	getCurrentSelection,
	getVisibleLineCount,
	getVisibleRanges,
	getLine0ForEditorLine,
	ScmError,
	getFileScmError
} from "@codestream/webview/store/editorContext/reducer";
import { CSTeam, CSUser, CodemarkType } from "@codestream/protocols/api";
import {
	setCodemarksFileViewStyle,
	setCodemarksShowArchived,
	setCodemarksShowResolved,
	setCurrentDocumentMarker,
	setNewPostEntry
} from "@codestream/webview/store/context/actions";
import { sortBy as _sortBy } from "lodash-es";
import { getTeamMembers } from "@codestream/webview/store/users/reducer";
import { setEditorContext } from "@codestream/webview/store/editorContext/actions";
import { CodeStreamState } from "@codestream/webview/store";
import ContainerAtEditorLine from "./ContainerAtEditorLine";
import ContainerAtEditorSelection from "./ContainerAtEditorSelection";
import { CodemarkForm } from "../CodemarkForm";
import { Card } from "./Card";
import { dataTransformer } from "@codestream/webview/store/data-filter";
import { DocumentMarkersActionsType } from "@codestream/webview/store/documentMarkers/types";
import { createPostAndCodemark } from "../actions";
import { Transformable } from "./Transformable";

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
	currentDocumentMarkerId: string | undefined;
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
	scmInfo?: GetFileScmInfoResponse;
	textEditorUri?: string;
	textEditorLineCount: number;
	firstVisibleLine: number;
	lastVisibleLine: number;
	numLinesVisible: number;
	textEditorVisibleRanges?: Range[];
	textEditorSelection?: EditorSelection;
	metrics: EditorMetrics;
	documentMarkers: DocumentMarker[];
	numUnpinned: number;
	numClosed: number;

	setEditorContext: (
		...args: Parameters<typeof setEditorContext>
	) => ReturnType<typeof setEditorContext>;
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
	setCurrentDocumentMarker: (
		...args: Parameters<typeof setCurrentDocumentMarker>
	) => ReturnType<typeof setCurrentDocumentMarker>;
	setMultiCompose(...args: any[]): void;
	setNewPostEntry(...args: Parameters<typeof setNewPostEntry>): void;

	createPostAndCodemark: Function;
	saveDocumentMarkers: Function;
}

interface State {
	lastSelectedLine: number;
	clickedPlus: boolean;
	isLoading: boolean;
	openIconsOnLine: number;
	query: string | undefined;
	highlightedLine?: number;
	rippledLine?: number;
	numAbove: number;
	numBelow: number;
	highlightedDocmarker: string | undefined;
	numLinesVisible: number;
	problem: ScmError | undefined;
	potentialCodemark: { key: string; type: CodemarkType } | undefined;
}

export class SimpleInlineCodemarks extends Component<Props, State> {
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
			potentialCodemark: undefined,
			isLoading: props.documentMarkers.length === 0,
			lastSelectedLine: 0,
			clickedPlus: false,
			query: undefined,
			openIconsOnLine: -1,
			numAbove: 0,
			numBelow: 0,
			highlightedDocmarker: undefined,
			numLinesVisible: props.numLinesVisible,
			problem: props.scmInfo && getFileScmError(props.scmInfo)
		};

		const modifier = navigator.appVersion.includes("Macintosh") ? "^ /" : "Ctrl-Shift-/";
		this.titles = {
			comment: (
				<span>
					<span className="function">Add Comment</span>{" "}
					<span className="keybinding extra-pad">{modifier}</span>
					<span className="keybinding">c</span>
				</span>
			),
			bookmark: (
				<span>
					<span className="function">Create Bookmark</span>{" "}
					<span className="keybinding extra-pad">{modifier}</span>
					<span className="keybinding">b</span>
				</span>
			),
			link: (
				<span>
					<span className="function">Get Permalink</span>{" "}
					<span className="keybinding extra-pad">{modifier}</span>
					<span className="keybinding">p</span>
				</span>
			),
			issue: (
				<span>
					<span className="function">Create Issue</span>{" "}
					<span className="keybinding extra-pad">{modifier}</span>
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

		// only set this if it changes by more than 1. we expect it to vary by 1 as
		// the topmost and bottommost line are revealed and the window is not an integer
		// number of lines high.
		if (Math.abs(props.numLinesVisible - Number(state.numLinesVisible)) > 1) {
			return {
				numLinesVisible: props.numLinesVisible
			};
		}

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
			subtree: true,
			attributes: true,
			attributeFilter: ["data-top"]
		});

		this.disposables.push(
			HostApi.instance.on(DidChangeDocumentMarkersNotificationType, ({ textDocument }) => {
				if (this.props.textEditorUri === textDocument.uri) {
					this.props.fetchDocumentMarkers(textDocument.uri);
				}
			}),
			{
				dispose() {
					mutationObserver.disconnect();
				}
			}
		);

		this.onFileChanged(true);

		this.scrollTo(this.props.metrics.lineHeight!);
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
			this.scrollTo(this.props.metrics.lineHeight!);
		}

		this.repositionCodemarks();
	}

	componentWillUnmount() {
		this.disposables.forEach(d => d.dispose());
	}

	scrollTo(top) {
		const $div = document.getElementById("inline-codemarks-scroll-container");
		if ($div) {
			$div.scrollTop = top;
		}
	}

	shiftUp(previousTop: number, $elements: HTMLElement[]) {
		let topOfLastDiv = previousTop;
		for (let $element of $elements) {
			const domRect = $element.getBoundingClientRect();

			const marginTop = parseInt($element.style.marginTop || "0", 10);
			// if this has been shifted down, account for that shift when calculating intersection?
			const overlap = topOfLastDiv - (domRect.bottom - marginTop);
			const minimumDistance = 20;
			const yDiff = overlap - minimumDistance;

			if (yDiff < 0) {
				$element.style.marginTop = `${yDiff}px`;
				// if this has been shifted down, account for that shift
				topOfLastDiv = domRect.top - marginTop + yDiff;
			} else {
				$element.style.marginTop = `${marginTop}px`;
				topOfLastDiv = domRect.top;
			}
		}
	}

	shiftDown(previousBottom: number, $elements: HTMLElement[]) {
		let bottomOfLastDiv = previousBottom;
		for (let $element of $elements) {
			const domRect = $element.getBoundingClientRect();
			const origTop = parseInt($element.dataset.top || "", 10);
			const minimumDistance = 20;
			const overlap = bottomOfLastDiv - origTop;
			const yDiff = overlap + minimumDistance;
			const height = domRect.bottom - domRect.top;

			if (yDiff > 0) {
				$element.style.marginTop = yDiff + "px";
				bottomOfLastDiv = origTop + height + yDiff;
			} else {
				$element.style.marginTop = "0";
				bottomOfLastDiv = origTop + height;
			}
		}
	}

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

		const composeIndex = $elements.findIndex($e => $e.classList.contains("compose"));

		if (composeIndex > -1) {
			const composeDimensions = $elements[composeIndex].getBoundingClientRect();
			this.shiftUp(composeDimensions.top, $elements.slice(0, composeIndex).reverse());
			this.shiftDown(composeDimensions.bottom, $elements.slice(composeIndex + 1));
		} else {
			this.shiftDown(-30, $elements);
		}
	};

	async onFileChanged(isInitialRender = false) {
		const { textEditorUri, setEditorContext } = this.props;

		if (textEditorUri === undefined || isNotOnDisk(textEditorUri)) {
			if (isInitialRender) {
				this.setState({ isLoading: false });
			}
			return;
		}

		let scmInfo = this.props.scmInfo;
		if (!scmInfo) {
			scmInfo = await HostApi.instance.send(GetFileScmInfoRequestType, {
				uri: textEditorUri!
			});
			setEditorContext({ scmInfo });
		}

		this.setState({ problem: getFileScmError(scmInfo) });

		await this.props.fetchDocumentMarkers(textEditorUri);
		this.setState(state => (state.isLoading ? { isLoading: false } : null));
	}

	compareStart(range1?: Range[], range2?: Range[]) {
		if (range1 == null || range1.length === 0 || range2 == null || range2.length === 0) return true;
		const start1 = range1[0].start.line;
		const start2 = range2[0].start.line;
		return start1 !== start2;
	}

	renderList = (paddingTop, fontSize, height) => {
		const { documentMarkers, showUnpinned, showClosed } = this.props;
		const { currentDocumentMarkerId } = this.props;

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
					{this.renderHoverIcons(this.state.numLinesVisible)}
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
										// collapsed={true}
										// inline={true}
										// hidden={hidden}
										// teammates={this.props.teammates}
										// hover={this.state.highlightedDocmarker === docMarker.id}
										// selected={currentDocumentMarkerId === docMarker.id}
										// usernames={this.props.usernames}
										// onClick={this.handleClickCodemark}
										// onMouseEnter={this.handleHighlightCodemark}
										// onMouseLeave={this.handleUnhighlightCodemark}
										// action={this.props.postAction}
										// query={this.state.query}
										// viewHeadshots={this.props.viewHeadshots}
										// postAction={this.props.postAction}
										// style={{ position: "relative", marginBottom: "20px" }}
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
		const { textEditorUri } = this.props;

		if (textEditorUri === undefined) {
			return (
				<div key="no-codemarks" className="no-codemarks">
					<h3>No file open.</h3>
					<p>
						Open a file to to start discussing code with your teammates!{" "}
						<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Building-a-Knowledge-Base-with-Codemarks">
							View guide.
						</a>
					</p>
				</div>
			);
		} else {
			if (this.props.children) return null;
			const modifier = navigator.appVersion.includes("Macintosh") ? "^ /" : "Ctrl-Shift-/";
			if (isNotOnDisk(textEditorUri)) {
				return (
					<div className="no-codemarks">
						<h3>This file hasn't been saved.</h3>
						<p>
							Save the file before creating a codemark so that the codemark can be linked to the
							code.
						</p>
					</div>
				);
			}
			if (this.state.problem === ScmError.NoRepo) {
				return (
					<div className="no-codemarks">
						<h3>This file is not part of a git repository.</h3>
						<p>
							CodeStream requires files to be managed by git so that codemarks can be linked to the
							code.
						</p>
					</div>
				);
			}
			if (this.state.problem === ScmError.NoRemotes) {
				return (
					<div className="no-codemarks">
						<h3>This repository has no remotes.</h3>
						<p>Please configure a remote URL for this repository before creating a codemark.</p>
					</div>
				);
			}
			if (this.state.problem === ScmError.NoGit) {
				return (
					<div className="no-codemarks">
						<h3>Git could not be located.</h3>
						<p>
							CodeStream was unable to find the `git` command. Make sure it's installed and
							configured properly.
						</p>
					</div>
				);
			}
			// giving this a 70% max width ensures that the tooltip
			// doesn't go wall-to-wall in the view. it'd be nice if
			// rc-tooltips handled this for us, but thereis no margin
			// to an rc-tooltip, so without this, it would literally
			// touch the left and right edges of the panel -Pez
			const title = (
				<div style={{ maxWidth: "70vw" }}>
					A codemark is a link between a block of code and a conversation, an issue, or a bookmark.
					Codemarks work across branches, and stay pinned to the block of code even as your codebase
					changes.
				</div>
			);
			return (
				<div key="no-codemarks" className="no-codemarks">
					There are no codemarks
					<Icon title={title} placement="top" className="superscript" name="info" /> in{" "}
					<b>{this.props.fileNameToFilterFor}</b>
					<br />
					<br />
					Discuss code with your team by selecting a range and clicking an icon (
					<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Building-a-Knowledge-Base-with-Codemarks">
						show me how
					</a>
					).
					<br />
					<br />
					<div className="keybindings">
						<div className="function-row">{this.titles.comment}</div>
						<div className="function-row">{this.titles.issue}</div>
						<div className="function-row">{this.titles.bookmark}</div>
						<div className="function-row">{this.titles.link}</div>
						<div className="function-row">
							<span className="function">Copy Private Permalink</span>
							<span className="keybinding extra-pad">{modifier}</span>
							<span className="keybinding extra-pad">⇧ p</span>
						</div>
						<div className="function-row">
							<span className="function">Toggle CodeStream Panel</span>
							<span className="keybinding extra-pad">{modifier}</span>
							<span className="keybinding extra-pad">{modifier}</span>
						</div>
					</div>
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
			documentMarkers,
			metrics
		} = this.props;
		const { numLinesVisible } = this.state;

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
					{this.renderPotentialCodemark() || this.renderNoCodemarks()}
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
			documentMarkers,
			showUnpinned,
			showClosed,
			currentDocumentMarkerId
		} = this.props;
		const { numLinesVisible } = this.state;

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
				<div
					style={{
						padding: `${this.props.metrics.lineHeight!}px 0`,
						margin: `-${this.props.metrics.lineHeight!}px 0`
					}}
				>
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
							{[this.renderPotentialCodemark()].concat(
								...(textEditorVisibleRanges || []).map((lineRange, rangeIndex) => {
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
												<ContainerAtEditorLine
													key={docMarker.key || docMarker.id}
													lineNumber={lineNum}
												>
													<div className="codemark-container">
														<Codemark
															codemark={codemark}
															marker={docMarker}
															// collapsed={true}
															// inline={true}
															// hidden={hidden}
															// teammates={this.props.teammates}
															// hover={this.state.highlightedDocmarker === docMarker.id}
															// selected={currentDocumentMarkerId === docMarker.id}
															// deselectCodemarks={this.deselectCodemarks}
															// usernames={this.props.usernames}
															// onClick={this.handleClickCodemark}
															// onMouseEnter={this.handleHighlightCodemark}
															// onMouseLeave={this.handleUnhighlightCodemark}
															// action={this.props.postAction}
															// query={this.state.query}
															// lineNum={lineNum}
															// postAction={this.props.postAction}
															// top={top}
														/>
													</div>
												</ContainerAtEditorLine>
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
								})
							)}
						</div>
						{this.renderHoverIcons(numLinesVisible)}
					</div>
				</div>
			</div>
		);
	}

	renderPotentialCodemark() {
		if (this.state.potentialCodemark == undefined) return null;

		return (
			<ContainerAtEditorSelection key={this.state.potentialCodemark.key}>
				<div className="codemark-container">
					<Card highlightOnHover={false}>
						<CodemarkForm
							commentType={this.state.potentialCodemark.type || CodemarkType.Comment}
							streamId={this.props.currentStreamId!}
							onSubmit={this.submitCodemark}
							onClickClose={() => {
								this.setState({ potentialCodemark: undefined });
							}}
							collapsed={false}
						/>
					</Card>
				</div>
			</ContainerAtEditorSelection>
		);
	}

	static contextTypes = {
		store: PropTypes.object
	};

	submitCodemark = async (attributes, event) => {
		let docMarker;
		const removeTransformer = dataTransformer.addTransformer(
			DocumentMarkersActionsType.SaveForFile,
			(payload: { uri: string; markers: DocumentMarker[] }) => {
				return payload.markers.filter(documentMarker => {
					if (documentMarker.version === 1) {
						const storeState: CodeStreamState = this.context.store.getState();
						const author = userSelectors.getUserByCsId(storeState.users, documentMarker.creatorId);
						if (author != undefined && author.id === storeState.session.userId) {
							if (
								documentMarker.commitHashWhenCreated === attributes.codeBlock.scm.revision &&
								areRangesEqual(documentMarker.range, attributes.codeBlock.range)
							) {
								docMarker = documentMarker;
								return true;
							}
						}
					}
					return false;
				});
			}
		);
		await this.props.createPostAndCodemark(attributes);
		await this.props.fetchDocumentMarkers(this.props.textEditorUri!);

		removeTransformer();

		if (docMarker) {
			batch(() => {
				this.props.saveDocumentMarkers(this.props.textEditorUri!, [
					{ ...docMarker, key: this.state.potentialCodemark!.key }
				]);
				this.setState({ potentialCodemark: undefined });
			});
		} else {
			this.setState({ potentialCodemark: undefined });
		}
	};

	private _clearWheelingStateTimeout?: any;
	private _wheelingState: { accumulatedPixels: number; topLine: number } | undefined;

	onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
		if (event.deltaY === 0) return;

		const target = event.target as HTMLElement;
		if (target.closest(".codemark.selected") != null) {
			return;
		}

		if (target.classList.contains("message-input") || target.closest(".compose") != null) {
			return;
		}

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

		const { metrics } = this.props;

		let deltaY = event.deltaY * metrics.scrollRatio!;

		let deltaPixels;
		let lines = 0;
		switch (event.deltaMode) {
			case 0: // deltaY is in pixels
				const lineHeight = metrics.lineHeight!;

				deltaPixels = deltaY;

				const pixels = this._wheelingState.accumulatedPixels + deltaY;
				this._wheelingState.accumulatedPixels = pixels % lineHeight;
				lines = pixels < 0 ? Math.ceil(pixels / lineHeight) : Math.floor(pixels / lineHeight);

				break;
			case 1: // deltaY is in lines
				lines = deltaY;

				break;
			case 2: // deltaY is in pages
				// Not sure how to handle it, nor is it worth the time
				debugger;

				break;
		}

		if (metrics.scrollMode !== EditorScrollMode.Pixels && lines === 0) return;

		let topLine;
		if (deltaY < 0) {
			topLine = Math.max(0, this._wheelingState.topLine + lines);
		} else {
			topLine = Math.min(this.props.textEditorLineCount, this._wheelingState.topLine + lines);
		}

		if (metrics.scrollMode !== EditorScrollMode.Pixels && topLine === this._wheelingState.topLine)
			return;

		// Update our tracking as the events will be too slow
		this._wheelingState.topLine = topLine;

		HostApi.instance.notify(EditorScrollToNotificationType, {
			uri: this.props.textEditorUri!,
			position: Position.create(topLine, 0),
			deltaPixels: deltaPixels,
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
					<Tooltip title="Show/hide resolved issues" placement="top" delay={1}>
						<span className="count" onClick={this.toggleShowClosed}>
							{numClosed} resolved
							<label className={cx("switch", { checked: this.props.showClosed })} />
						</span>
					</Tooltip>
				)}
				{numUnpinned > 0 && (
					<Tooltip title="Show/hide archived codemarks" placement="top" delay={1}>
						<span className="count" onClick={this.toggleShowUnpinned}>
							{numUnpinned} archived
							<label className={cx("switch", { checked: this.props.showUnpinned })} />
						</span>
					</Tooltip>
				)}
				<Tooltip
					title="Display codemarks as a list, or next to the code they reference"
					placement="topRight"
					delay={1}
				>
					<span className="count" onClick={this.toggleViewCodemarksInline}>
						list
						<label className={cx("switch ", { checked: !viewInline })} />
					</span>
				</Tooltip>
				<Feedback />
			</div>
		);
	}

	render() {
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
		this.props.setCurrentDocumentMarker(undefined);
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
				let lineNum = parseInt(line, 10) - 1;
				if (
					!done &&
					lineNum < firstVisibleLine &&
					!this.hiddenCodemarks[this.docMarkersByStartLine[line].id]
				) {
					lineNum = Math.max(0, lineNum);
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
				let lineNum = parseInt(line, 10) + 1;
				if (
					!done &&
					lineNum > lastVisibleLine &&
					!this.hiddenCodemarks[this.docMarkersByStartLine[line].id]
				) {
					lineNum = Math.max(0, lineNum);
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
			await HostApi.instance.send(EditorSelectRangeRequestType, {
				uri: this.props.textEditorUri!,
				selection: { ...range, cursor: range.end },
				preserveFocus: true
			});
		}

		// Clear the previous highlight
		this.handleUnhighlightLine(lineNum0);

		// Clear the open icons
		// this works subtly... we tell state to not open icons on any line,
		// but normally getDerivedStateFromProps would override that. By
		// resetting openIconsOnLine but *not* lastSelectedLine,
		// getDerivedStateFromProps won't fire.
		this.setState({ clickedPlus: true, potentialCodemark: { key: shortUuid(), type } }, () =>
			requestAnimationFrame((this.props as any).focusInput)
		);

		// setup git context for codemark form
		// this.props.setMultiCompose(
		// 	true,
		// 	{ commentType: type, top: top },
		// 	{ uri: this.props.textEditorUri, range: range, setSelection: setSelection }
		// );
		// setTimeout(() => this.props.focusInput(), 500);
	};

	handleClickCodemark = async (
		event: React.MouseEvent,
		codemark: CodemarkPlus,
		docMarker: DocumentMarker
	) => {
		const target = event.target as HTMLElement | undefined;
		if (target && (target.classList.contains("info") || target.closest(".info"))) {
			return;
		}

		if (this.props.currentDocumentMarkerId === docMarker.id) {
			if (target && (target.classList.contains("author") || target.closest(".author"))) {
				this.deselectCodemarks();
			}
			return;
		}

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
			try {
				const response = await HostApi.instance.send(GetDocumentFromMarkerRequestType, {
					markerId: markerId
				});

				// TODO: What should we do if we don't find the marker? Is that possible?
				if (response) {
					// Ensure we put the cursor at the right line (don't actually select the whole range)
					HostApi.instance.send(EditorSelectRangeRequestType, {
						uri: response.textDocument.uri,
						selection: {
							start: response.range.start,
							end: response.range.start,
							cursor: response.range.start
						},
						preserveFocus: true
					});
				}
			} catch (error) {
				// TODO:
			}
		}

		this.props.setCurrentDocumentMarker(docMarker.id);
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
const EMPTY_OBJECT = {};

const mapStateToProps = (state: CodeStreamState) => {
	const { context, editorContext, teams, configs, documentMarkers } = state;

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
		currentDocumentMarkerId: context.currentDocumentMarkerId,
		currentStreamId: context.currentStreamId,
		usernames: userSelectors.getUsernames(state),
		teammates: teamMembers,
		team: teams[context.currentTeamId],
		viewInline: context.codemarksFileViewStyle === "inline",
		viewHeadshots: configs.showHeadshots,
		showLabelText: false, //configs.showLabelText,
		showClosed: context.codemarksShowResolved || false,
		showUnpinned: context.codemarksShowArchived || false,
		fileNameToFilterFor: editorContext.activeFile,
		scmInfo: editorContext.scmInfo,
		textEditorUri: editorContext.textEditorUri,
		textEditorLineCount: editorContext.textEditorLineCount || 0,
		firstVisibleLine,
		lastVisibleLine,
		textEditorVisibleRanges,
		textEditorSelection: getCurrentSelection(editorContext),
		metrics: editorContext.metrics || EMPTY_OBJECT,
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
		setCodemarksShowResolved,
		setCurrentDocumentMarker,
		setEditorContext,
		setNewPostEntry,
		createPostAndCodemark,
		saveDocumentMarkers
	}
)(SimpleInlineCodemarks);
