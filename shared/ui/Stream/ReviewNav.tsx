import React from "react";
import styled from "styled-components";
import Menu from "./Menu";
import Tooltip from "./Tooltip";
import { Review } from "./Review";
import { Button } from "../src/components/Button";
import { PanelHeader } from "../src/components/PanelHeader";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentReview, setActiveReview } from "@codestream/webview/store/context/actions";
import { useDidMount } from "@codestream/webview/utilities/hooks";
import { HostApi } from "..";
import { GetReviewRequestType, GetFileScmInfoResponse } from "@codestream/protocols/agent";
import { saveReviews } from "@codestream/webview/store/reviews/actions";
import { CodeStreamState } from "../store";
import { getReview } from "../store/reviews/reducer";
import { MinimumWidthCard } from "./Codemark/BaseCodemark";
import SearchResult from "./SearchResult";
import { InlineMenu } from "../src/components/controls/InlineMenu";
import { fetchThread, setReviewStatus, setUserPreference, createPost } from "./actions";
import * as fs from "../utilities/fs";
import { ReviewShowDiffRequestType } from "../ipc/host.protocol.review";
import { BoxedContent } from "../src/components/BoxedContent";
import Icon from "./Icon";
import { ChangesetFile } from "./Review/ChangesetFile";

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
		transition: transform 0.2s;
		transform-origin: 50% 0%;
		&:last-child {
			transform-origin: 100% 0%;
		}
		&.pulse {
			transform: scale(1.5);
			background: var(--app-background-color);
			button {
				box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);
			}
		}
		button {
			margin-left: 10px;
			&:first-child {
				margin-left: 0;
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

const ComposeArea = styled.div`
	width: 150px;
	height: 100%;
	position: fixed;
	left: -151px;
	top: 0;
	transition: left 0.1s;
	background: var(--base-background-color);
	border-right: 1px solid var(--base-border-color);
	&.pulse {
		left: 0;
	}
`;

const modifier = navigator.appVersion.includes("Macintosh") ? "^ /" : "Ctrl-Shift-/";

export type Props = React.PropsWithChildren<{ reviewId: string }>;

export function ReviewNav(props: Props) {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const { scmInfo } = state.editorContext;
		const filePath = scmInfo && scmInfo.scm ? scmInfo.scm.file : "";
		const review = getReview(state.reviews, props.reviewId);

		const modifiedFilesByRepo = [] as any;
		if (review) {
			review.reviewChangesets.forEach(changeset => {
				changeset.modifiedFiles.forEach(file => {
					modifiedFilesByRepo.push({ ...file, repoId: changeset.repoId });
				});
			});
		}

		return {
			review,
			modifiedFilesByRepo,
			editorContext: state.editorContext,
			filePath,
			currentCodemarkId: state.context.currentCodemarkId
		};
	});
	const [notFound, setNotFound] = React.useState(false);
	const [hoverButton, setHoverButton] = React.useState("");
	const [progressCounter, setProgressCounter] = React.useState(0);

	const { review, modifiedFilesByRepo } = derivedState;

	const changedFiles = React.useMemo(() => {
		if (!review) return;
		const files: any[] = [];
		for (let changeset of review.reviewChangesets) {
			files.push(
				...changeset.modifiedFiles.map(f => {
					// FIXME -- need to check for repoId here too
					// console.log()
					const selected = derivedState.filePath === f.file;
					return (
						<ChangesetFile
							className={selected ? "selected" : undefined}
							onClick={async e => {
								jumpToFile({ ...f, repoId: changeset.repoId });
							}}
							key={f.file}
							{...f}
						/>
					);
				})
			);
		}
		return files;
	}, [review, derivedState.filePath]);

	const exit = async () => {
		await dispatch(setCurrentReview());
		await dispatch(setActiveReview());
	};

	const showReview = async () => {
		await dispatch(setActiveReview());
		await dispatch(setCurrentReview(review && review.id));
	};

	useDidMount(() => {
		let isValid = true;
		const fetchReview = async () => {
			try {
				const response = await HostApi.instance.send(GetReviewRequestType, {
					reviewId: props.reviewId
				});
				if (!isValid) return;
				else dispatch(saveReviews([response.review]));
			} catch (error) {
				setNotFound(true);
			}
		};

		if (review == null) {
			fetchReview();
		}

		return () => {
			isValid = false;
		};
	});

	const submitReply = async text => {
		await dispatch(createPost(review!.streamId, review!.postId, text));
	};

	const approve = () => {
		dispatch(setReviewStatus(review!.id, "closed"));
		submitReply("/me approved this review");
	};
	const reject = () => {
		dispatch(setReviewStatus(review!.id, "rejected"));
		submitReply("/me rejected this review");
	};
	const reopen = () => {
		dispatch(setReviewStatus(review!.id, "open"));
		submitReply("/me reopened this review");
	};

	const statusButtons = () => {
		if (!review) return;
		switch (review.status) {
			case "open":
				return (
					<div className={hoverButton == "actions" ? "btn-group pulse" : "btn-group"}>
						<Tooltip title="Pause Review" placement="bottom">
							<Button variant="secondary" onClick={exit}>
								Pause
							</Button>
						</Tooltip>
						<Tooltip title="Approve Review" placement="bottom">
							<Button variant="success" onClick={approve}>
								Approve
							</Button>
						</Tooltip>
						<Tooltip title="Reject Review" placement="bottom">
							<Button variant="destructive" onClick={reject}>
								Reject
							</Button>
						</Tooltip>
					</div>
				);
			case "closed":
			case "rejected":
				return (
					<div className={hoverButton == "actions" ? "btn-group pulse" : "btn-group"}>
						<Button variant="secondary" onClick={exit}>
							Exit
						</Button>
						<Button variant="secondary" onClick={reopen}>
							Reopen
						</Button>
					</div>
				);
		}
	};

	const hideInstructions = () => {};

	const Instructions = () => {
		return (
			<VerticallyCenter>
				<StyledBoxedContent title="Review Instructions" onClose={hideInstructions}>
					<InstructionList>
						<InstructionItem>
							View details of the review{" "}
							<u onMouseOver={() => setHoverButton("info")} onMouseOut={() => setHoverButton("")}>
								here
							</u>
							<Subtext>Including which files have changed</Subtext>
						</InstructionItem>
						<InstructionItem>
							Step through the changes of the review{" "}
							<u onMouseOver={() => setHoverButton("nav")} onMouseOut={() => setHoverButton("")}>
								here
							</u>
							<Subtext>
								Next change:
								<span className="binding">
									<span className="keybinding extra-pad">{modifier}</span>
									<span className="keybinding">&darr;</span>
								</span>
								&nbsp;&nbsp;&nbsp; Previous Change:
								<span className="binding">
									<span className="keybinding extra-pad">{modifier}</span>
									<span className="keybinding">&uarr;</span>
								</span>
							</Subtext>
						</InstructionItem>
						<InstructionItem>
							Comment on changes by{" "}
							<u
								onMouseOver={() => setHoverButton("comment")}
								onMouseOut={() => setHoverButton("")}
							>
								hovering in the left margin
							</u>
							<Subtext>You can also add comments to related code as part of this review.</Subtext>
							<Subtext>
								Add Comment:
								<span className="binding">
									<span className="keybinding extra-pad">{modifier}</span>
									<span className="keybinding">c</span>
								</span>
							</Subtext>
						</InstructionItem>
						<InstructionItem>
							When finished,{" "}
							<u
								onMouseOver={() => setHoverButton("actions")}
								onMouseOut={() => setHoverButton("")}
							>
								approve or reject
							</u>{" "}
							the review
							<Subtext>Or pause to come back to it later</Subtext>
							<Subtext>
								Approve:
								<span className="binding">
									<span className="keybinding extra-pad">{modifier}</span>
									<span className="keybinding">a</span>
								</span>
								&nbsp;&nbsp;&nbsp; Reject:
								<span className="binding">
									<span className="keybinding extra-pad">{modifier}</span>
									<span className="keybinding">x</span>
								</span>
							</Subtext>
						</InstructionItem>
					</InstructionList>
				</StyledBoxedContent>
			</VerticallyCenter>
		);
	};

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
		nextIndex = nextIndex || modifiedFilesByRepo.findIndex(f => f.file === derivedState.filePath);
		setProgressCounter(nextIndex || 0);
	};

	const jumpToPrev = () =>
		jumpToFile(modifiedFilesByRepo[progressCounter - 1], progressCounter - 1);
	const jumpToNext = () =>
		jumpToFile(modifiedFilesByRepo[progressCounter + 1], progressCounter + 1);
	const nextCount = modifiedFilesByRepo.length - progressCounter;
	const prevCount = progressCounter;

	if (notFound || !review) return <MinimumWidthCard>This review was not found</MinimumWidthCard>;
	if (derivedState.currentCodemarkId) return null;

	const fileIndex = modifiedFilesByRepo.findIndex(f => f.file === derivedState.filePath) + 1;
	const fileMenu = modifiedFilesByRepo.map(f => {
		return { label: f.file, key: f.file, action: () => jumpToFile(f, 0) };
	});

	// let title = fs.pathBasename(derivedState.filePath || "");
	let title = fs.pathBasename(
		derivedState.filePath || derivedState.editorContext.activeFile || ""
	) || <>&nbsp;</>;
	return (
		<>
			<PanelHeader title={title} position="fixed" className="active-review">
				{false && (
					<FileList>
						{fileIndex > 0 ? (
							<span>
								Reviewing change #5 of 17 in{" "}
								<InlineMenu items={fileMenu}>
									file #{fileIndex} of {modifiedFilesByRepo.length}
								</InlineMenu>
							</span>
						) : (
							<span>
								This file is not one of the{" "}
								<InlineMenu items={fileMenu}>{modifiedFilesByRepo.length} modified</InlineMenu> in
								this review.
							</span>
						)}
					</FileList>
				)}
			</PanelHeader>
			<Nav>
				<div className={hoverButton == "info" ? "btn-group pulse" : "btn-group"}>
					<Tooltip
						placement="bottom"
						title={
							<>
								<SearchResult titleOnly result={review} />
								<div style={{ height: "5px" }} />
								{changedFiles}
							</>
						}
					>
						<Button variant="secondary" onClick={showReview}>
							<Icon name="info" />
						</Button>
					</Tooltip>
				</div>
				{statusButtons()}
				<div className={hoverButton == "nav" ? "btn-group pulse" : "btn-group"}>
					<Tooltip title="Next Change" placement="bottomRight">
						<Button onClick={jumpToNext}>{nextCount} &darr;</Button>
					</Tooltip>
					<Tooltip title="Previous Change" placement="bottomRight">
						<Button onClick={jumpToPrev}>{prevCount} &uarr;</Button>
					</Tooltip>
				</div>
			</Nav>
			<Instructions />
			<Actions>
				{/*				<div className="review-title">{review && <SearchResult titleOnly result={review} />}</div> */}
			</Actions>
			<ComposeArea className={hoverButton == "comment" ? "pulse" : ""} />
		</>
	);
}
