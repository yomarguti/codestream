import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect, batch } from "react-redux";
import * as userSelectors from "../store/users/reducer";
import Icon from "./Icon";
import ScrollBox from "./ScrollBox";
import Tooltip from "./Tooltip"; // careful with tooltips on codemarks; they are not performant
import Feedback from "./Feedback";
import cx from "classnames";
import {
	range,
	debounceToAnimationFrame,
	isNotOnDisk,
	ComponentUpdateEmitter,
	isRangeEmpty,
	safe,
	uriToFilePath
} from "../utils";
import { HostApi } from "../webview-api";
import {
	EditorHighlightRangeRequestType,
	EditorRevealRangeRequestType,
	MaxRangeValue,
	EditorSelection,
	EditorMetrics,
	EditorScrollToNotificationType,
	EditorScrollMode,
	NewCodemarkNotificationType
} from "../ipc/webview.protocol";
import {
	DocumentMarker,
	DidChangeDocumentMarkersNotificationType,
	GetFileScmInfoResponse,
	GetFileScmInfoRequestType
} from "@codestream/protocols/agent";
import { Range, Position } from "vscode-languageserver-types";
import { fetchDocumentMarkers, addDocumentMarker } from "../store/documentMarkers/actions";
import {
	getCurrentSelection,
	getVisibleLineCount,
	getVisibleRanges,
	getLine0ForEditorLine,
	ScmError,
	getFileScmError
} from "../store/editorContext/reducer";
import { CSTeam, CodemarkType, CSMe } from "@codestream/protocols/api";
import {
	setCodemarksFileViewStyle,
	setCodemarksShowArchived,
	setCurrentCodemark,
	setSpatialViewPRCommentsToggle
} from "../store/context/actions";
import { sortBy as _sortBy } from "lodash-es";
import { setEditorContext, changeSelection } from "../store/editorContext/actions";
import { CodeStreamState } from "../store";
import ContainerAtEditorLine from "./SpatialView/ContainerAtEditorLine";
import ContainerAtEditorSelection from "./SpatialView/ContainerAtEditorSelection";
import { CodemarkForm } from "./CodemarkForm";
import { middlewareInjector } from "../store/middleware-injector";
import { DocumentMarkersActionsType } from "../store/documentMarkers/types";
import { createPostAndCodemark } from "./actions";
import Codemark from "./Codemark";
import { PostEntryPoint } from "../store/context/types";
import { localStore } from "../utilities/storage";
import { PRInfoModal } from "./SpatialView/PRInfoModal";
import { isConnected } from "../store/providers/reducer";

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
	hasPRProvider: boolean;
	showPRComments: boolean;
	currentStreamId?: string;
	team: CSTeam;
	viewInline: boolean;
	viewHeadshots: boolean;
	showLabelText: boolean;
	showHidden: boolean;
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
	numHidden: number;

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
	setCurrentCodemark: (
		...args: Parameters<typeof setCurrentCodemark>
	) => ReturnType<typeof setCurrentCodemark>;

	createPostAndCodemark: (...args: Parameters<typeof createPostAndCodemark>) => any;
	addDocumentMarker: Function;
	changeSelection: Function;
	setSpatialViewPRCommentsToggle: Function;
}

interface State {
	showPRInfoModal: boolean;
	lastSelectedLine: number;
	clickedPlus: boolean;
	isLoading: boolean;
	openIconsOnLine: number;
	query: string | undefined;
	highlightedLine?: number;
	rippledLine?: number;
	numAbove: number;
	numBelow: number;
	numLinesVisible: number;
	problem: ScmError | undefined;
	newCodemarkAttributes: { type: CodemarkType; viewingInline: boolean } | undefined;
}

const NEW_CODEMARK_ATTRIBUTES_TO_RESTORE = "spatial-view:restore-codemark-form";

export class SimpleInlineCodemarks extends Component<Props, State> {
	disposables: { dispose(): void }[] = [];
	titles: {
		comment: JSX.Element;
		// bookmark: JSX.Element;
		link: JSX.Element;
		issue: JSX.Element;
		about: JSX.Element;
	};
	docMarkersByStartLine: {};
	_scrollDiv: HTMLDivElement | null | undefined;
	private root = React.createRef<HTMLDivElement>();
	hiddenCodemarks = {};
	currentPostEntryPoint?: PostEntryPoint;
	_updateEmitter = new ComponentUpdateEmitter();
	minimumDistance = 20;
	_waitingForPRProviderConnection = false;

	constructor(props: Props) {
		super(props);

		this.state = {
			showPRInfoModal: false,
			newCodemarkAttributes: localStore.get(NEW_CODEMARK_ATTRIBUTES_TO_RESTORE),
			isLoading: props.documentMarkers.length === 0,
			lastSelectedLine: 0,
			clickedPlus: false,
			query: undefined,
			openIconsOnLine: -1,
			numAbove: 0,
			numBelow: 0,
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
			// bookmark: (
			// 	<span>
			// 		<span className="function">Create Bookmark</span>{" "}
			// 		<span className="keybinding extra-pad">{modifier}</span>
			// 		<span className="keybinding">b</span>
			// 	</span>
			// ),
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
		HostApi.instance.track("Page Viewed", { "Page Name": "CurrentFile Tab" });
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
			},
			HostApi.instance.on(NewCodemarkNotificationType, e => {
				this.currentPostEntryPoint = e.source as PostEntryPoint;
				this.handleClickPlus(undefined, e.type, undefined as any, false);
			})
		);

		this.onFileChanged(true);

		this.scrollTo(this.props.metrics.lineHeight!);
	}

	componentDidUpdate(prevProps: Props) {
		this._updateEmitter.emit();
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

		if (
			this.props.hasPRProvider &&
			!prevProps.hasPRProvider &&
			this._waitingForPRProviderConnection
		) {
			this.props.setSpatialViewPRCommentsToggle(true);
		}

		this.repositionCodemarks();
	}

	componentWillUnmount() {
		if (this.state.newCodemarkAttributes != undefined) {
			localStore.set(NEW_CODEMARK_ATTRIBUTES_TO_RESTORE, this.state.newCodemarkAttributes);
		} else {
			localStore.delete(NEW_CODEMARK_ATTRIBUTES_TO_RESTORE);
		}
		this.disposables.forEach(d => d.dispose());
	}

	scrollTo(top) {
		const $div = document.getElementById("inline-codemarks-scroll-container");
		if ($div) {
			$div.scrollTop = top;
		}
	}

	// shiftUp and shiftDown use different frames of reference to
	// determine height -- one takes into account the container's
	// padding (due to breadcrumbs or other UI elements in the editor)
	// and the other does not. this should be simplified so that there
	// aren't subtle bugs introduced
	shiftUp(previousTop: number, $elements: HTMLElement[]) {
		let topOfLastDiv = previousTop;
		for (let $element of $elements) {
			const domRect = $element.getBoundingClientRect();

			// determine the difference between the top of the last div, and
			// this one, to see if there is an overlap
			const overlap = domRect.bottom - topOfLastDiv;
			// even if there is zero overlap, we want at least a minimum
			// distance, so we add this.minimumDistance to compare
			const yDiff = Math.round(overlap + this.minimumDistance);

			// if there is greater than zero overlap (when taking into
			// account the minimum distance between boxes), we need to
			// shift this box up
			if (yDiff > 0) {
				// the new marginTop for this box is equal to the old
				// one, minus the overlap yDiff
				const marginTop = parseInt($element.style.marginTop || "0", 10);
				$element.style.marginTop = `${marginTop - yDiff}px`;
				// now that we shifted this box up, the top of it's
				// domRect will be yDiff less
				topOfLastDiv = domRect.top - yDiff;
			} else {
				topOfLastDiv = domRect.top;
			}
		}
	}

	shiftDown(previousBottom: number, $elements: HTMLElement[]) {
		let bottomOfLastDiv = previousBottom;
		// loop through all of the elements and use dataset.top
		// as the "originally desired" position which represents
		// where the inline view would put the box ideally to the
		// right of the code. we use that as a starting point to
		// know where the box wants to be ideally. as we shift
		// boxes down, we keep track of the bottom of the last box
		// as a minimum starting point for the top of the next one
		for (let $element of $elements) {
			const domRect = $element.getBoundingClientRect();
			const origTop = parseInt($element.dataset.top || "", 10);
			const overlap = bottomOfLastDiv - origTop;
			const yDiff = Math.round(overlap + this.minimumDistance);
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
		let $containerDivs: HTMLElement[] = Array.from(
			document.querySelectorAll(".plane-container:not(.cs-off-plane)")
		);
		if ($containerDivs.length > 0) this.repositionElements($containerDivs);

		let $hiddenDivs: HTMLElement[] = Array.from(
			document.querySelectorAll(".plane-container.cs-hidden")
		);
		if ($hiddenDivs.length > 0) this.repositionElements($hiddenDivs);
	});

	repositionElements = ($elements: HTMLElement[]) => {
		$elements.sort((a, b) => Number(a.dataset.top) - Number(b.dataset.top));

		const composeIndex = $elements.findIndex($e => {
			return $e.children[0].classList.contains("codemark-form-container");
		});

		if (composeIndex > -1) {
			const $element = $elements[composeIndex];
			const domRect = $element.getBoundingClientRect();
			const top = parseInt($element.dataset.top || "", 10);
			const height = domRect.bottom - domRect.top;
			this.shiftUp(domRect.top, $elements.slice(0, composeIndex).reverse());
			this.shiftDown(
				// we subtract minimumDistance (20px) here because
				// otherwise there is 40px margin below the compose
				// box, since it adds 20 more before it shifts down
				// composeDimensions.bottom - this.minimumDistance,
				top + height,
				$elements.slice(composeIndex + 1)
			);
		} else {
			// -3000 is just an arbitrary off-screen number that will allow
			// codemarks that appear above the viewport to render properly,
			// even if we just get a glimpse of the bottom of them because
			// they are off-screen. If codemarks are more than 3000px hight
			// when collapsed this will be a bug, but fine otherwise. -Pez
			this.shiftDown(-3000, $elements);
		}
	};

	async onFileChanged(isInitialRender = false) {
		const { textEditorUri, setEditorContext } = this.props;

		if (textEditorUri === undefined && this.state.newCodemarkAttributes) {
			this.setState({ newCodemarkAttributes: undefined });
		}

		if (textEditorUri === undefined || isNotOnDisk(textEditorUri)) {
			if (isInitialRender) {
				this.setState({ isLoading: false });
			}
			return;
		}

		let scmInfo = this.props.scmInfo;
		if (!scmInfo) {
			this.setState({ isLoading: true });
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
		const { documentMarkers, showHidden } = this.props;

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
						className="channel-list vscroll spatial-list"
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

								// const hidden =
								// 	!showHidden &&
								// 	((codemark && (!codemark.pinned || codemark.status === "closed")) ||
								// 		(docMarker.externalContent && !this.props.showPRComments));

								const hidden =
									(!showHidden &&
										(codemark && (!codemark.pinned || codemark.status === "closed"))) ||
									(docMarker.externalContent && !this.props.showPRComments);
								if (hidden) {
									this.hiddenCodemarks[docMarker.id] = true;
									return null;
								}

								return (
									<div key={docMarker.id} className="codemark-container">
										<Codemark
											contextName="Spatial View"
											codemark={docMarker.codemark}
											marker={docMarker}
											hidden={hidden}
											highlightCodeInTextEditor
											query={this.state.query}
											viewHeadshots={this.props.viewHeadshots}
											postAction={this.props.postAction}
										/>
									</div>
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
						key="comment"
						onClick={e => this.handleClickPlus(e, CodemarkType.Comment, lineNum0)}
						name="comment"
						title={this.titles.comment}
						placement="bottomLeft"
						align={{ offset: [-3, 10] }}
						delay={1}
					/>,
					<Icon
						onClick={e => this.handleClickPlus(e, CodemarkType.Issue, lineNum0)}
						name="issue"
						key="issue"
						title={this.titles.issue}
						placement="bottomLeft"
						align={{ offset: [-3, 10] }}
						delay={1}
					/>,
					// <Icon
					// 	onClick={e => this.handleClickPlus(e, CodemarkType.Bookmark, lineNum0)}
					// 	name="bookmark"
					// 	key="bookmark"
					// 	title={this.titles.bookmark}
					// 	placement="bottomLeft"
					// 	align={{ offset: [-3, 10] }}
					// 	delay={1}
					// />,
					// <Icon
					//  key="about"
					// 	onClick={e => this.handleClickPlus(e, "about", lineNum0, top)}
					// 	name="about"
					// 	title={this.titles.about}
					// 	placement="bottomLeft"
					// 	align={{ offset: [-3, 10] }}
					// 	delay={1}
					// />,
					<Icon
						onClick={e => this.handleClickPlus(e, CodemarkType.Link, lineNum0)}
						name="link"
						key="link"
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
		const { highlightedLine, rippledLine, newCodemarkAttributes } = this.state;

		// if the compose box is active, don't render the
		// hover icons. even though you could technically
		// argue that this is a loss of fucntionality
		// (one extra click to reposition the compose box)
		// the UX is just too weird/messy keeping those
		// buttons active. see google docs for comparison,
		// who hide the (+) when you have a compose box
		if (newCodemarkAttributes != undefined) return null;

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
				<div key="no-codemarks" className="no-codemarks-container">
					<div key="no-codemarks" className="no-codemarks">
						<h3>No file open.</h3>
						<p>
							Open a file to to start discussing code with your teammates!{" "}
							<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Building-a-Knowledge-Base-with-Codemarks">
								View guide.
							</a>
						</p>
					</div>
				</div>
			);
		} else {
			if (this.props.children) return null;
			const modifier = navigator.appVersion.includes("Macintosh") ? "^ /" : "Ctrl-Shift-/";
			if (isNotOnDisk(textEditorUri)) {
				return (
					<div key="no-codemarks" className="no-codemarks-container">
						<div className="no-codemarks">
							<h3>This file hasn't been saved.</h3>
							<p>
								Save the file before creating a codemark so that the codemark can be linked to the
								code.
							</p>
						</div>
					</div>
				);
			}
			if (this.state.problem === ScmError.NoRepo) {
				return (
					<div key="no-codemarks" className="no-codemarks-container">
						<div className="no-codemarks">
							<h3>This file is not part of a git repository.</h3>
							<p>
								CodeStream requires files to be tracked by Git so that codemarks can be linked to
								the code.
							</p>
							<p>{uriToFilePath(textEditorUri)}</p>
						</div>
					</div>
				);
			}
			if (this.state.problem === ScmError.NoRemotes) {
				return (
					<div key="no-codemarks" className="no-codemarks-container">
						<div className="no-codemarks">
							<h3>This repository has no remotes.</h3>
							<p>Please configure a remote URL for this repository before creating a codemark.</p>
						</div>
					</div>
				);
			}
			if (this.state.problem === ScmError.NoGit) {
				return (
					<div key="no-codemarks" className="no-codemarks-container">
						<div className="no-codemarks">
							<h3>Git could not be located.</h3>
							<p>
								CodeStream was unable to find the `git` command. Make sure it's installed and
								configured properly.
							</p>
						</div>
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
					A codemark is a link between a block of code and a conversation or an issue. Codemarks
					work across branches, and stay pinned to the block of code even as your codebase changes.
				</div>
			);
			return (
				<div key="no-codemarks" className="no-codemarks-container">
					<div className="no-codemarks">
						Discuss code with your team by selecting a range and clicking an icon, or by using a
						shortcut below (
						<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Building-a-Knowledge-Base-with-Codemarks">
							show me how
						</a>
						).
						<br />
						<br />
						<div className="keybindings">
							<div className="function-row">{this.titles.comment}</div>
							<div className="function-row">{this.titles.issue}</div>
							{
								// <div className="function-row">{this.titles.bookmark}</div>
							}
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
					{this.renderCodemarkForm() || this.renderNoCodemarks()}
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
			showHidden
		} = this.props;
		const { numLinesVisible } = this.state;

		const numVisibleRanges = textEditorVisibleRanges.length;
		let numAbove = 0,
			numBelow = 0;
		// create a map from start-lines to the codemarks that start on that line
		// and while we're at it, count the number of non-filtered-out codemarks
		// that are above the current viewport, and below the current viewport
		this.docMarkersByStartLine = {};
		this.hiddenCodemarks = {};
		documentMarkers.forEach(docMarker => {
			const codemark = docMarker.codemark;
			let startLine = Number(this.getMarkerStartLine(docMarker));
			// if there is already a codemark on this line, keep skipping to the next one
			while (this.docMarkersByStartLine[startLine]) startLine++;
			this.docMarkersByStartLine[startLine] = docMarker;
			const hidden =
				!showHidden &&
				((codemark && (!codemark.pinned || codemark.status === "closed")) ||
					(docMarker.externalContent && !this.props.showPRComments));
			if (hidden) {
				this.hiddenCodemarks[docMarker.id] = true;
			} else {
				if (startLine < firstVisibleLine) numAbove++;
				if (startLine > lastVisibleLine) numBelow++;
			}
		});

		if (numAbove != this.state.numAbove) this.setState({ numAbove });
		if (numBelow != this.state.numBelow) this.setState({ numBelow });

		let rangeStartOffset = 0;
		return (
			<div
				style={{ height: "100vh" }}
				onWheel={this.onWheel}
				id="inline-codemarks-scroll-container"
				ref={ref => (this._scrollDiv = ref)}
				onClick={this.handleClickField}
				data-scrollable="true"
				className={cx("scrollbox", { "off-top": firstVisibleLine > 0 })}
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
							{this.renderCodemarkForm()}
							{textEditorVisibleRanges.map((lineRange, rangeIndex) => {
								const realFirstLine = lineRange.start.line;
								const realLastLine = lineRange.end.line;
								const linesInRange = realLastLine - realFirstLine + 1;
								// if this is the first range, we start 20 lines above the viewport to
								// try to capture any codemarks that are out of view, but the bottom
								// may still be visible
								const lineToStartOn = rangeIndex == 0 ? realFirstLine - 20 : realFirstLine;
								const marksInRange = range(lineToStartOn, realLastLine + 1).map(lineNum => {
									const docMarker = this.docMarkersByStartLine[lineNum];
									if (!docMarker) return null;
									return this.renderInlineCodemark(docMarker, lineNum);
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

	renderInlineCodemark(docMarker, lineNum) {
		const codemark = docMarker.codemark;
		const hidden = this.hiddenCodemarks[docMarker.id] ? true : false;
		return (
			<ContainerAtEditorLine
				key={docMarker.id}
				lineNumber={lineNum}
				className={cx({
					"cs-hidden": hidden,
					"cs-off-plane": hidden
				})}
			>
				<div className="codemark-container">
					<Codemark
						contextName="Spatial View"
						codemark={codemark}
						marker={docMarker}
						deselectCodemarks={this.deselectCodemarks}
						hidden={hidden}
						highlightCodeInTextEditor
						query={this.state.query}
						postAction={this.props.postAction}
					/>
				</div>
			</ContainerAtEditorLine>
		);
	}

	renderCodemarkForm() {
		if (this.state.newCodemarkAttributes == undefined) return null;

		return (
			<ContainerAtEditorSelection>
				<div className="codemark-form-container">
					<CodemarkForm
						commentType={this.state.newCodemarkAttributes.type}
						streamId={this.props.currentStreamId!}
						onSubmit={this.submitCodemark}
						onClickClose={this.closeCodemarkForm}
						collapsed={false}
					/>
				</div>
			</ContainerAtEditorSelection>
		);
	}

	closeCodemarkForm = () => {
		this.clearSelection();

		const { newCodemarkAttributes } = this.state;
		if (newCodemarkAttributes && !newCodemarkAttributes.viewingInline) {
			batch(() => {
				this.setState({ newCodemarkAttributes: undefined });
				this.props.setCodemarksFileViewStyle("list");
			});
		} else this.setState({ newCodemarkAttributes: undefined });
	};

	static contextTypes = {
		store: PropTypes.object
	};

	submitCodemark = async (attributes, event) => {
		let docMarker: DocumentMarker | undefined;
		const removeTransformer = middlewareInjector.inject(
			DocumentMarkersActionsType.SaveForFile,
			(payload: { uri: string; markers: DocumentMarker[] }) => {
				return {
					...payload,
					markers: payload.markers.filter(documentMarker => {
						const storeState: CodeStreamState = this.context.store.getState();
						const author = userSelectors.getUserByCsId(storeState.users, documentMarker.creatorId);
						if (author != undefined && author.id === storeState.session.userId) {
							if (
								documentMarker.commitHashWhenCreated === attributes.codeBlock.scm.revision &&
								documentMarker.code === attributes.codeBlock.contents
							) {
								docMarker = documentMarker;
								return false;
							}
						}
						return true;
					})
				};
			}
		);
		await this.props.createPostAndCodemark(
			attributes,
			this.currentPostEntryPoint || "Spatial View"
		);
		this.currentPostEntryPoint = undefined;
		await this.props.fetchDocumentMarkers(this.props.textEditorUri!);

		removeTransformer();

		if (docMarker) {
			batch(() => {
				this._updateEmitter.enqueue(() => {
					this.closeCodemarkForm();
				});
				this.props.addDocumentMarker(this.props.textEditorUri!, docMarker);
			});
		} else {
			this.closeCodemarkForm();
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

		if (target.closest(".code.preview") != null) {
			return;
		}

		if (target.classList.contains("message-input") || target.closest(".compose") != null) {
			return;
		}
		if (target.closest(".mentions-popup") != null) {
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
		const { numHidden, viewInline } = this.props;
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
				<Tooltip title="Show/hide pull request comments" placement="top" delay={1}>
					<span className="count" onClick={this.togglePRComments}>
						PRs <label className={cx("switch", { checked: this.props.showPRComments })} />
					</span>
				</Tooltip>
				{numHidden > 0 && (
					<Tooltip title="Show/hide archived codemarks" placement="top" delay={1}>
						<span className="count" onClick={this.toggleShowHidden}>
							{numHidden} archived
							<label className={cx("switch", { checked: this.props.showHidden })} />
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
				{this.state.showPRInfoModal && (
					<PRInfoModal onClose={() => this.setState({ showPRInfoModal: false })} />
				)}
				{this.state.isLoading ? null : this.renderCodemarks()}
				{this.printViewSelectors()}
			</div>
		);
	}

	clearSelection = () => {
		const { textEditorSelection } = this.props;
		if (textEditorSelection && !isRangeEmpty(textEditorSelection)) {
			const position = Position.create(
				textEditorSelection.cursor.line,
				textEditorSelection.cursor.character
			);
			const range = Range.create(position, position);
			this.props.changeSelection(this.props.textEditorUri!, { ...range, cursor: range.end });
			// just short-circuits the round-trip to the editor
			this.setState({ openIconsOnLine: -1 });
		}
	};

	handleClickField = (event: React.SyntheticEvent<HTMLDivElement>) => {
		if (event && event.target) {
			const id = (event.target as any).id;
			if (
				id === "inline-codemarks-scroll-container" ||
				id === "inline-codemarks-field" ||
				id === "codemark-blanket" ||
				(event.target as any).classList.contains("plane-container")
			) {
				this.deselectCodemarks();
			}
		}
	};

	deselectCodemarks = () => {
		this.props.setCurrentCodemark();
		this.clearSelection();
	};

	enableAnimations(fn: Function) {
		// Turn on the CSS animations (there is probably a more react way to do this)
		this._scrollDiv && this._scrollDiv.classList.add("animate");

		fn();

		// Turn on the CSS animations (there is probably a more react way to do this)
		setTimeout(() => this._scrollDiv && this._scrollDiv.classList.remove("animate"), 500);
	}

	toggleViewCodemarksInline = () => {
		this.props.setCodemarksFileViewStyle(this.props.viewInline ? "list" : "inline");
	};

	toggleShowHidden = () => {
		this.enableAnimations(() => this.props.setCodemarksShowArchived(!this.props.showHidden));
	};

	togglePRComments = () => {
		if (this.props.hasPRProvider)
			this.enableAnimations(() =>
				this.props.setSpatialViewPRCommentsToggle(!this.props.showPRComments)
			);
		else {
			this._waitingForPRProviderConnection = true;
			this.setState({ showPRInfoModal: true });
		}
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

	handleClickPlus = async (
		event: React.SyntheticEvent | undefined,
		type: CodemarkType,
		lineNum0: number,
		shouldChangeSelection = true
	) => {
		if (event) event.preventDefault();

		const viewingInline = this.props.viewInline;
		if (!viewingInline) {
			this.props.setCodemarksFileViewStyle("inline");
			try {
				await new Promise((resolve, reject) => {
					this._updateEmitter.enqueue(() => {
						if (this.props.viewInline) resolve();
						else reject();
					});
				});
			} catch (error) {
				return;
			}
		}

		const { openIconsOnLine } = this.state;
		const { textEditorSelection } = this.props;

		const mappedLineNum = this.mapLine0ToVisibleRange(lineNum0);

		if (shouldChangeSelection) {
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
				const newSelection: EditorSelection = { ...range, cursor: range.end };
				// HACK: although the changeSelection action creator will update the redux store,
				// this component needs to update the store pre-emptively to avoid flashing the hover button
				// before the form appears. the flash is because as the selection changes, we try to show the hover button to initiate opening the form
				this.props.setEditorContext({ textEditorSelections: [newSelection] });
				this.props.changeSelection(this.props.textEditorUri!, newSelection);
			}

			// Clear the previous highlight
			this.handleUnhighlightLine(lineNum0);
		}

		// Clear the open icons
		// this works subtly... we tell state to not open icons on any line,
		// but normally getDerivedStateFromProps would override that. By
		// resetting openIconsOnLine but *not* lastSelectedLine,
		// getDerivedStateFromProps won't fire.
		this.setState({
			clickedPlus: true,
			newCodemarkAttributes: { type, viewingInline }
		});

		this.props.setCurrentCodemark();
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

// const fakeDocMarker = {
// 	createdAt: new Date().getTime(),
// 	creatorId: "github",
// 	creatorName: "GitHub",
// 	externalContent: {
// 		providerName: "github",
// 		url: "https://github.com/akonwi/git-plus/issues/1",
// 		pr:
// 			comment.pullRequest == null
// 				? undefined
// 				: { id: comment.pullRequest.id, url: comment.pullRequest.url }
// 	}
// };

const mapStateToProps = (state: CodeStreamState) => {
	const { context, editorContext, teams, configs, documentMarkers } = state;

	const docMarkers = documentMarkers[editorContext.textEditorUri || ""] || EMPTY_ARRAY;
	const numHidden = docMarkers.filter(
		d => d.codemark && (!d.codemark.pinned || d.codemark.status === "closed")
	).length;

	const textEditorVisibleRanges = getVisibleRanges(editorContext);
	const numVisibleRanges = textEditorVisibleRanges.length;

	let lastVisibleLine = 1;
	let firstVisibleLine = 1;
	if (numVisibleRanges > 0) {
		const lastVisibleRange = textEditorVisibleRanges[numVisibleRanges - 1];
		lastVisibleLine = lastVisibleRange!.end.line;
		firstVisibleLine = textEditorVisibleRanges[0].start.line;
	}

	const hasPRProvider = ["github", "bitbucket"].some(name => isConnected(state, name));

	return {
		hasPRProvider,
		currentStreamId: context.currentStreamId,
		team: teams[context.currentTeamId],
		viewInline: context.codemarksFileViewStyle === "inline",
		viewHeadshots: configs.showHeadshots,
		showLabelText: false, //configs.showLabelText,
		showHidden: context.codemarksShowArchived || false,
		showPRComments: hasPRProvider && context.spatialViewShowPRComments,
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
		numHidden
	};
};

export default connect(
	mapStateToProps,
	{
		fetchDocumentMarkers,
		setCodemarksFileViewStyle,
		setCodemarksShowArchived,
		setCurrentCodemark,
		setEditorContext,
		createPostAndCodemark,
		addDocumentMarker,
		changeSelection,
		setSpatialViewPRCommentsToggle
	}
)(SimpleInlineCodemarks);
