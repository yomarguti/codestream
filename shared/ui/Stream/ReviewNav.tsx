import React from "react";
import styled from "styled-components";
import Tooltip from "./Tooltip";
import { Button } from "../src/components/Button";
import { PanelHeader } from "../src/components/PanelHeader";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { setCurrentReview, setActiveReview } from "@codestream/webview/store/context/actions";
import { useDidMount } from "@codestream/webview/utilities/hooks";
import { HostApi } from "..";
import { GetReviewRequestType } from "@codestream/protocols/agent";
import { fetchReview } from "@codestream/webview/store/reviews/actions";
import { CodeStreamState } from "../store";
import { getReview } from "../store/reviews/reducer";
import { MinimumWidthCard, Meta, HeaderActions, Header } from "./Codemark/BaseCodemark";
import SearchResult from "./SearchResult";
import { InlineMenu } from "../src/components/controls/InlineMenu";
import { setReviewStatus } from "./actions";
import * as fs from "../utilities/fs";
import { ReviewShowDiffRequestType, TraverseDiffsRequestType } from "../ipc/host.protocol.review";
import { BoxedContent } from "../src/components/BoxedContent";
import Icon from "./Icon";
import { ChangesetFile } from "./Review/ChangesetFile";
import { confirmPopup } from "./Confirm";
import { setUserPreference } from "./actions";
import { ReviewChangesetFileInfo } from "@codestream/protocols/api";
import { ChangesetFileList } from "./Review/ChangesetFileList";
import { Dispatch } from "../store/common";
import { Review, ExpandedAuthor, Description } from "./Review";
import ScrollBox from "./ScrollBox";
import { Dialog } from "../src/components/Dialog";
import { TourTip } from "../src/components/TourTip";
import { Modal } from "./Modal";
import { MarkdownText } from "./MarkdownText";

const Actions = styled.div`
	padding: 0 0 0 20px;
	width: 100%;
	position: fixed;
	align-items: center;
	bottom: 0px;
	right: 0;
	display: flex;
	justify-content: flex-end;
	z-index: 25;
	background: var(--base-background-color);
	border-top: 1px solid var(--base-border-color);
	text-align: right;
	button {
		margin: 10px 10px 10px 0;
	}
	.review-title {
		max-height: 75px;
		overflow: hidden;
		text-align: left;
		flex-grow: 2;
		// to balance out the line-height to give it
		// a vertically centered look
		padding-top: 3px;
		padding-bottom: 8px;
	}
	// white-space: nowrap;
`;

const Nav = styled.div`
	position: fixed;
	top: 10px;
	right: 10px;
	z-index: 50;
	&.pulse {
		opacity: 1 !important;
	}
	.btn-group {
		display: inline-block;
		margin-left: 10px;
		transition: transform 0.1s;
		transform-origin: 50% 0%;
		&:last-child {
			transform-origin: 100% 0%;
		}
		button {
			margin-left: 10px;
			&:first-child {
				margin-left: 0;
			}
			.narrow-icon {
				display: none;
			}
		}
	}
`;
const ClearModal = styled.div`
	position: absolute;
	z-index: 51;
	width: 100%;
	height: 100%;
	top: 0;
	left: 0;
`;
const Root = styled.div`
	${Header} {
		.icon.type {
			display: none;
		}
		${HeaderActions} {
			margin-top: 3px;
		}
	}
	background: (--panel-tool-background-color);
	&.tour-on {
		${Nav},
		${Meta},
		${Description},
		${ExpandedAuthor},
		${Header} {
			opacity: 0.25;
		}
	}
	#changed-files {
		transition: opacity 0.2s;
	}
	.pulse #changed-files {
		opacity: 1;
		box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);
		background: var(--app-background-color-hover);
	}

	.scroll-container {
		margin: 50px 0 0 0;
		position: absolute;
		top: 0;
		left: 0;
		height: 100vh;
		width: 100%;
		overflow: auto;
		zindex: 1;
	}

	@media only screen and (max-width: 300px) {
		.btn-group {
			button {
				.narrow-icon {
					display: block;
				}
				.wide-text {
					display: none;
				}
				padding: 3px 5px;
				line-height: 1em;
			}
		}
		.scroll-container {
			margin: 45px 0 0 0;
		}
	}
`;

const FileList = styled.div`
	color: var(--text-color-subtle);
`;

const VerticallyCenter = styled.div`
	position: fixed;
	width: 100%;
	top: 50%;
	transform: translateY(-50%);
	padding: 0 20px;
	z-index: 1;
`;

const InstructionList = styled.ol`
	padding-inline-start: 15px;
	// font-size: larger;
`;
const InstructionItem = styled.li`
	margin: 0 0 20px 0;
	cursor: pointer;
	u {
	}
	&:hover {
		color: var(--text-color-highlight);
	}
`;

const Subtext = styled.div`
	padding-top: 5px;
	font-size: smaller;
	color: var(--text-color-subtle);
`;

const StyledBoxedContent = styled(Dialog)`
	max-width: 30em;
	margin: 0 auto;
	button {
		display: block;
		margin: 0 auto;
		width: 6em;
	}
`;

export const ComposeArea = styled.div`
	width: 35px;
	height: 100%;
	position: fixed;
	left: -36px;
	top: 0;
	transition: left 0.1s;
	background: var(--base-background-color);
	border-right: 1px solid var(--base-border-color);
	&.pulse {
		left: 0;
	}
`;

export const StyledReview = styled.div``;

const Tip = styled.div`
	button {
		margin-top: 10px;
		float: right;
	}
	b {
		display: block;
		clear: both;
	}
`;

const Step = styled.div`
	float: left;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 20px;
	width: 40px;
	height: 40px;
	border-radius: 50%;
	margin: 0 10px 10px 0;
	font-weight: bold;

	background: var(--button-background-color);
	color: var(--button-foreground-color);
	// background: var(--text-color-highlight);
	// color: var(--base-background-color);
`;

const modifier = navigator.appVersion.includes("Macintosh") ? "^ /" : "Ctrl-Shift-/";

export type Props = React.PropsWithChildren<{ reviewId: string; composeOpen: boolean }>;

export function ReviewNav(props: Props) {
	const dispatch = useDispatch<Dispatch>();
	const derivedState = useSelector((state: CodeStreamState) => {
		const { scmInfo } = state.editorContext;
		const filePath = scmInfo && scmInfo.scm ? scmInfo.scm.file : "";
		const review = getReview(state.reviews, props.reviewId);

		return {
			review,
			editorContext: state.editorContext,
			filePath,
			hideReviewInstructions: state.preferences.hideReviewInstructions,
			currentCodemarkId: state.context.currentCodemarkId
		};
	}, shallowEqual);

	const allModifiedFiles = React.useMemo(() => {
		const modifiedFiles: (ReviewChangesetFileInfo & { repoId: string })[] = [];

		if (derivedState.review) {
			derivedState.review.reviewChangesets.forEach(changeset => {
				changeset.modifiedFiles.forEach(file => {
					modifiedFiles.push({ ...file, repoId: changeset.repoId });
				});
			});
		}

		return modifiedFiles;
	}, [derivedState.review]);
	const [notFound, setNotFound] = React.useState(false);
	const [hoverButton, setHoverButton] = React.useState(
		derivedState.hideReviewInstructions ? "" : "files"
	);
	const [progressCounter, setProgressCounter] = React.useState(0);

	const { review } = derivedState;

	const exit = async () => {
		await dispatch(setCurrentReview());
		// await dispatch(setActiveReview());
	};

	const showReview = async () => {
		// await dispatch(setActiveReview());
		await dispatch(setCurrentReview(review && review.id));
	};

	useDidMount(() => {
		let isValid = true;
		if (review == null) {
			dispatch(fetchReview(props.reviewId)).then(result => {
				if (!isValid) return;
				if (result == null) setNotFound(true);
			});
		}
		// else {
		// 	const currentFile = allModifiedFiles[progressCounter];
		// 	HostApi.instance.send(ReviewShowDiffRequestType, {
		// 		repoId: currentFile.repoId,
		// 		reviewId: review.id,
		// 		path: currentFile.file
		// 	});
		// }

		return () => {
			isValid = false;
		};
	});

	const approve = () => {
		dispatch(setReviewStatus(review!.id, "closed"));
		showReview();
	};

	const reject = () => {
		confirmPopup({
			title: "Are you sure?",
			message: "Author will be notified you have rejected this set of changes.",
			buttons: [
				{ label: "Go Back", className: "control-button" },
				{
					label: "Reject Changes",
					wait: true,
					action: rejectConfirm,
					className: "delete"
				}
			]
		});
	};

	const rejectConfirm = () => {
		dispatch(setReviewStatus(review!.id, "rejected"));
		showReview();
	};

	const reopen = () => {
		dispatch(setReviewStatus(review!.id, "open"));
	};

	const statusButtons = () => {
		if (!review) return null;
		switch (review.status) {
			case "open":
				return (
					<div className={hoverButton == "actions" ? "btn-group pulse" : "btn-group"}>
						<Tooltip
							title={
								<>
									Approve Review{" "}
									<span className="binding">
										<span className="keybinding extra-pad">{modifier}</span>
										<span className="keybinding">a</span>
									</span>
								</>
							}
							placement="bottom"
						>
							<Button variant="success" onClick={approve}>
								<Icon className="narrow-icon" name="thumbsup" />
								<span className="wide-text">Approve</span>
							</Button>
						</Tooltip>
						<Tooltip
							title={
								<>
									Reject Review{" "}
									<span className="binding">
										<span className="keybinding extra-pad">{modifier}</span>
										<span className="keybinding">x</span>
									</span>
								</>
							}
							placement="bottom"
						>
							<Button variant="destructive" onClick={reject}>
								<Icon className="narrow-icon" name="thumbsdown" />
								<span className="wide-text">Reject</span>
							</Button>
						</Tooltip>
						<Tooltip
							title={
								<>
									Pause Review{" "}
									<span className="binding">
										<span className="keybinding">ESC</span>
									</span>
								</>
							}
							placement="bottomRight"
						>
							<Button variant="secondary" onClick={exit}>
								<Icon className="narrow-icon" name="x" />
								<span className="wide-text">Exit</span>
							</Button>
						</Tooltip>
					</div>
				);
			case "closed":
			case "rejected":
				return (
					<div className={hoverButton == "actions" ? "btn-group pulse" : "btn-group"}>
						<Tooltip title="Reopen Review" placement="bottomRight">
							<Button variant="secondary" onClick={reopen}>
								<Icon className="narrow-icon" name="reopen" />
								<span className="wide-text">Reopen</span>
							</Button>
						</Tooltip>
						<Tooltip
							title={
								<>
									Exit Review{" "}
									<span className="binding">
										<span className="keybinding">ESC</span>
									</span>
								</>
							}
							placement="bottomRight"
						>
							<Button variant="secondary" onClick={exit}>
								<Icon className="narrow-icon" name="x" />
								<span className="wide-text">Exit</span>
							</Button>
						</Tooltip>
					</div>
				);
			default:
				return null;
		}
		return null;
	};

	const toggleInstructions = () => {
		dispatch(setUserPreference(["hideReviewInstructions"], !derivedState.hideReviewInstructions));
	};

	const renderedInstructions = React.useMemo(() => {
		return (
			<VerticallyCenter>
				<StyledBoxedContent title="Review Instructions">
					<InstructionList>
						{false && (
							<InstructionItem
								onMouseEnter={() => setHoverButton("info")}
								onMouseLeave={() => setHoverButton("")}
							>
								<u>View details</u> of the review
								<Subtext>Including which files have changed</Subtext>
							</InstructionItem>
						)}
						<InstructionItem
							onMouseEnter={() => setHoverButton("files")}
							onMouseLeave={() => setHoverButton("")}
						>
							<u>Step through</u> the changes of the review
							<Subtext>By clicking on file names in any order</Subtext>
						</InstructionItem>
						<InstructionItem
							onMouseEnter={() => setHoverButton("comment")}
							onMouseLeave={() => setHoverButton("")}
						>
							<u>Comment on changes</u> in the left margin
							<Subtext>You can also comment on related code as part of the review</Subtext>
						</InstructionItem>
						<InstructionItem
							onMouseEnter={() => setHoverButton("actions")}
							onMouseLeave={() => setHoverButton("")}
						>
							<u>Approve or reject</u> the review when finished
							<Subtext>Or exit to come back to it later</Subtext>
						</InstructionItem>
					</InstructionList>
					<Button onClick={toggleInstructions}>Got it</Button>
				</StyledBoxedContent>
			</VerticallyCenter>
		);
	}, [derivedState.hideReviewInstructions]);

	const jumpToFile = async (fileRecord, nextIndex?: number) => {
		if (!review) return;
		await HostApi.instance.send(ReviewShowDiffRequestType, {
			reviewId: review.id,
			repoId: fileRecord.repoId,
			path: fileRecord.file
		});
		// await HostApi.instance.send(ReviewShowDiffRequestType, {
		// 	reviewId: review.id,
		// 	repoId: changeset.repoId,
		// 	path: f.file
		// });
		nextIndex = nextIndex || allModifiedFiles.findIndex(f => f.file === derivedState.filePath);
		setProgressCounter(nextIndex || 0);
	};

	const jumpToPrev = () => {
		// HostApi.instance.send(TraverseDiffsRequestType, {
		// 	direction: "previous"
		// });
		jumpToFile(allModifiedFiles[progressCounter - 1], progressCounter - 1);
	};
	const jumpToNext = () => {
		// HostApi.instance.send(TraverseDiffsRequestType, {
		// 	direction: "next"
		// });
		jumpToFile(allModifiedFiles[progressCounter + 1], progressCounter + 1);
	};
	const nextCount = allModifiedFiles.length - progressCounter;
	const prevCount = progressCounter;

	if (notFound || !review) return <MinimumWidthCard>This review was not found</MinimumWidthCard>;
	if (derivedState.currentCodemarkId) return null;

	const fileIndex = allModifiedFiles.findIndex(f => f.file === derivedState.filePath) + 1;
	const fileMenu = allModifiedFiles.map(f => {
		return { label: f.file, key: f.file, action: () => jumpToFile(f, 0) };
	});

	const tourDone = () => {
		setHoverButton("");
		toggleInstructions();
	};

	// let title = fs.pathBasename(derivedState.filePath || "");
	let title = fs.pathBasename(
		derivedState.filePath || derivedState.editorContext.activeFile || ""
	) || <>&nbsp;</>;

	const filesTip =
		hoverButton === "files" ? (
			<Tip>
				<Step>1</Step> Step through the changes of the review
				<Subtext>By clicking on filenames in any order</Subtext>
				<Button onClick={() => setHoverButton("comment")}>Next ></Button>
				<b></b>
			</Tip>
		) : (
			undefined
		);

	const commentTip =
		hoverButton === "comment" ? (
			<Tip>
				<Step>2</Step>Comment on changes in the left margin
				<Subtext>You can also comment on related code as part of the review</Subtext>
				<Button onClick={() => setHoverButton("actions")}>Next ></Button>
				<b></b>
			</Tip>
		) : (
			undefined
		);

	const actionsTip =
		hoverButton === "actions" ? (
			<Tip>
				<Step>3</Step>Approve or reject the review when finished
				<Subtext>Or pause to come back to it later</Subtext>
				<Button onClick={tourDone}>Done</Button>
				<b></b>
			</Tip>
		) : (
			undefined
		);

	return (
		<Root className={derivedState.hideReviewInstructions ? "" : "tour-on"}>
			{!derivedState.hideReviewInstructions && <ClearModal />}
			<Nav className={hoverButton == "actions" ? "pulse" : ""}>
				<TourTip title={actionsTip} placement="bottomRight">
					{statusButtons()}
				</TourTip>
			</Nav>
			{props.composeOpen ? null : (
				<div className="scroll-container">
					<ScrollBox>
						<div
							className="vscroll"
							style={{
								padding: "0 10px 60px 40px",
								width: "100%"
							}}
						>
							<StyledReview className={hoverButton == "files" ? "pulse" : ""}>
								<Review review={review} filesTip={filesTip} />
							</StyledReview>

							{derivedState.hideReviewInstructions && (
								<div
									style={{ marginTop: "5px", fontSize: "smaller", cursor: "pointer" }}
									onClick={() => {
										setHoverButton("files");
										toggleInstructions();
									}}
								>
									Show Instructions
								</div>
							)}
						</div>
					</ScrollBox>
				</div>
			)}

			<Actions>
				{/*				<div className="review-title">{review && <SearchResult titleOnly result={review} />}</div> */}
			</Actions>
			<TourTip title={commentTip} placement="right">
				<ComposeArea className={hoverButton == "comment" ? "pulse" : ""} />
			</TourTip>
		</Root>
	);
}
