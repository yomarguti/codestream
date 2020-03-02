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
import { MinimumWidthCard } from "./Codemark/BaseCodemark";
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
import { Review } from "./Review";
import ScrollBox from "./ScrollBox";

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
	z-index: 126;
	.btn-group {
		display: inline-block;
		margin-left: 10px;
		transition: transform 0.1s;
		transform-origin: 50% 0%;
		&:last-child {
			transform-origin: 100% 0%;
		}
		&.pulse {
			transform: scale(1.5);
			background: var(--app-background-color);
			button {
				// box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);
				box-shadow: 0 5px 30px rgba(0, 0, 0, 0.8);
				// box-shadow: 0 0 10px rgba(255, 255, 0, 1);
			}
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
	@media only screen and (max-width: 550px) {
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
	}
	@media only screen and (max-width: 350px) {
		.btn-group {
			margin-left: 5px;
			button {
				margin-left: 5px;
			}
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
	padding-inline-start: 35px;
	// font-size: larger;
`;
const InstructionItem = styled.li`
	margin: 0 0 20px 0;
	u {
		cursor: pointer;
	}
	// color: var(--text-color-highlight);
`;

const Subtext = styled.div`
	padding-top: 5px;
	font-size: smaller;
	color: var(--text-color-subtle);
`;

const StyledBoxedContent = styled(BoxedContent)`
	max-width: 30em;
	margin: 0 auto;
	padding: 5px 0 0 0;
	h2 {
		font-size: 16px;
		font-weight: normal;
	}
	> span.title {
		top: -17px;
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
	const [hoverButton, setHoverButton] = React.useState("");
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
		} else {
			const currentFile = allModifiedFiles[progressCounter];
			HostApi.instance.send(ReviewShowDiffRequestType, {
				repoId: currentFile.repoId,
				reviewId: review.id,
				path: currentFile.file
			});
		}

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
		if (!review) return;
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
										<span className="keybinding extra-pad">{modifier}</span>
										<span className="keybinding">z</span>
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
						<Tooltip
							title={
								<>
									Exit Review{" "}
									<span className="binding">
										<span className="keybinding extra-pad">{modifier}</span>
										<span className="keybinding">z</span>
									</span>
								</>
							}
							placement="bottom"
						>
							<Button variant="secondary" onClick={exit}>
								<Icon className="narrow-icon" name="x" />
								<span className="wide-text">Exit</span>
							</Button>
						</Tooltip>
						<Tooltip
							title={
								<>
									Reopen Review{" "}
									<span className="binding">
										<span className="keybinding extra-pad">{modifier}</span>
										<span className="keybinding">&darr;</span>
									</span>
								</>
							}
							placement="bottomRight"
						>
							<Button variant="secondary" onClick={reopen}>
								<Icon className="narrow-icon" name="reopen" />
								<span className="wide-text">o</span>
							</Button>
						</Tooltip>
					</div>
				);
			default:
				return;
		}
	};

	const toggleInstructions = () => {
		dispatch(setUserPreference(["hideReviewInstructions"], !derivedState.hideReviewInstructions));
	};

	const renderedInstructions = React.useMemo(() => {
		return (
			<VerticallyCenter>
				<StyledBoxedContent title="Review Instructions" onClose={toggleInstructions}>
					<InstructionList>
						{false && (
							<InstructionItem>
								<u
									onMouseEnter={() => setHoverButton("info")}
									onMouseLeave={() => setHoverButton("")}
								>
									View details
								</u>{" "}
								of the review
								<Subtext>Including which files have changed</Subtext>
							</InstructionItem>
						)}
						<InstructionItem>
							<u
								onMouseEnter={() => setHoverButton("files")}
								onMouseLeave={() => setHoverButton("")}
							>
								Step through
							</u>{" "}
							the changes of the review
							<Subtext>By clicking on file names in any order</Subtext>
						</InstructionItem>
						<InstructionItem>
							<u
								onMouseEnter={() => setHoverButton("comment")}
								onMouseLeave={() => setHoverButton("")}
							>
								Comment on changes
							</u>{" "}
							in the left margin
							<Subtext>You can also comment on related code as part of the review</Subtext>
						</InstructionItem>
						<InstructionItem>
							<u
								onMouseEnter={() => setHoverButton("actions")}
								onMouseLeave={() => setHoverButton("")}
							>
								Approve or reject
							</u>{" "}
							the review when finished
							<Subtext>Or pause to come back to it later</Subtext>
						</InstructionItem>
					</InstructionList>
					<Button>Got it</Button>
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

	// let title = fs.pathBasename(derivedState.filePath || "");
	let title = fs.pathBasename(
		derivedState.filePath || derivedState.editorContext.activeFile || ""
	) || <>&nbsp;</>;

	return (
		<>
			{false && (
				<PanelHeader title={title} position="fixed" className="active-review"></PanelHeader>
			)}
			<Nav>
				{false && (
					<div className={hoverButton == "info" ? "btn-group pulse" : "btn-group"}>
						<Tooltip
							placement="bottom"
							title={
								"Show/Hide Review Details"
								// <>
								// 	<SearchResult titleOnly result={review} />
								// 	<div style={{ height: "5px" }} />
								// 	<ChangesetFileList review={review} />
								// 	{derivedState.hideReviewInstructions && (
								// 		<div
								// 			style={{ marginTop: "5px", fontSize: "smaller", cursor: "pointer" }}
								// 			onClick={toggleInstructions}
								// 		>
								// 			Show Instructions
								// 		</div>
								// 	)}
								// </>
							}
						>
							<Button variant="secondary" onClick={toggleInstructions}>
								<Icon name="i" />
							</Button>
						</Tooltip>
					</div>
				)}
				{false && (
					<div className={hoverButton == "nav" ? "btn-group pulse" : "btn-group"}>
						<Tooltip
							title={
								<>
									Next Change{" "}
									<span className="binding">
										<span className="keybinding extra-pad">{modifier}</span>
										<span className="keybinding">&darr;</span>
									</span>
								</>
							}
							placement="bottom"
						>
							<Button onClick={jumpToNext}>
								<span className="wide-text">{nextCount} </span>
								<Icon name="arrow-down" />
							</Button>
						</Tooltip>
						<Tooltip
							title={
								<>
									Previous Change{" "}
									<span className="binding">
										<span className="keybinding extra-pad">{modifier}</span>
										<span className="keybinding">&uarr;</span>
									</span>
								</>
							}
							placement="bottom"
						>
							<Button onClick={jumpToPrev}>
								<span className="wide-text">{prevCount} </span>
								<Icon name="arrow-up" />
							</Button>
						</Tooltip>
					</div>
				)}
				{statusButtons()}
			</Nav>
			{props.composeOpen ? null : (
				<div
					style={{
						position: "absolute",
						top: "0",
						left: "0",
						height: "100vh",
						width: "100%",
						margin: "0 0 0 0",
						overflow: "auto",
						zIndex: 1
					}}
				>
					{!derivedState.hideReviewInstructions && renderedInstructions}
					<ScrollBox>
						<div
							className="vscroll"
							style={{
								padding: "15px 20px 60px 40px",
								width: "100%",
								opacity: derivedState.hideReviewInstructions ? 1 : 0.35
							}}
						>
							<Review review={review} />
							{derivedState.hideReviewInstructions && (
								<div
									style={{ marginTop: "5px", fontSize: "smaller", cursor: "pointer" }}
									onClick={toggleInstructions}
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
			<ComposeArea className={hoverButton == "comment" ? "pulse" : ""} />
		</>
	);
}
