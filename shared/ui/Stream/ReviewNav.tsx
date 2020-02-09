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

const ReviewActions = styled.div`
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
	button {
		margin-left: 10px;
	}
`;

const FileList = styled.div`
	color: var(--text-color-subtle);
`;

export type Props = React.PropsWithChildren<{
	reviewId: string;
}>;

export function ReviewNav(props: Props) {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const { scmInfo } = state.editorContext;
		const filePath = scmInfo && scmInfo.scm ? scmInfo.scm.file : "";
		return {
			editorContext: state.editorContext,
			filePath,
			currentCodemarkId: state.context.currentCodemarkId
		};
	});
	const [notFound, setNotFound] = React.useState(false);
	const review = useSelector((state: CodeStreamState) => {
		return getReview(state.reviews, props.reviewId);
	});

	const exit = async () => {
		await dispatch(setCurrentReview());
		await dispatch(setActiveReview());
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
					<>
						<Button variant="secondary" onClick={exit}>
							Pause
						</Button>
						<Button variant="success" onClick={approve}>
							Approve
						</Button>
						<Button variant="destructive" onClick={reject}>
							Reject
						</Button>
					</>
				);
			case "closed":
			case "rejected":
				return (
					<>
						<Button variant="secondary" onClick={exit}>
							Exit
						</Button>
						<Button variant="secondary" onClick={reopen}>
							Reopen
						</Button>
					</>
				);
		}
	};

	const switchToFile = file => {};

	const filesByRepo = () => {
		const ret = [] as any;
		if (!review) return ret;
		review.reviewChangesets.forEach(changeset => {
			changeset.modifiedFiles.forEach(file => {
				ret.push({ ...file, repoId: changeset.repoId });
			});
		});
		return ret;
	};

	if (notFound) return <MinimumWidthCard>This review was not found</MinimumWidthCard>;
	if (derivedState.currentCodemarkId) return null;

	const files = filesByRepo();
	const fileIndex = files.findIndex(f => f.file === derivedState.filePath) + 1;
	const fileMenu = files.map(f => {
		return { label: f.file, key: f.file, action: () => switchToFile(f) };
	});

	// let title = fs.pathBasename(derivedState.filePath || "");
	let title = fs.pathBasename(
		derivedState.filePath || derivedState.editorContext.activeFile || ""
	) || <>&nbsp;</>;
	return (
		<>
			<PanelHeader title={title} position="fixed" className="active-review">
				<FileList>
					{fileIndex > 0 ? (
						<span>
							Reviewing change #5 of 17 in{" "}
							<InlineMenu items={fileMenu}>
								file #{fileIndex} of {files.length}
							</InlineMenu>
						</span>
					) : (
						<span>
							This file is not one of the{" "}
							<InlineMenu items={fileMenu}>{files.length} modified</InlineMenu> in this review.
						</span>
					)}
				</FileList>
			</PanelHeader>
			<Nav>
				<Tooltip title="Next Change" placement="bottomRight">
					<Button>4 &darr;</Button>
				</Tooltip>
				<Tooltip title="Previous Change" placement="bottomRight">
					<Button>12 &uarr;</Button>
				</Tooltip>
			</Nav>
			<ReviewActions>
				<div className="review-title">{review && <SearchResult titleOnly result={review} />}</div>
				{statusButtons()}
			</ReviewActions>
		</>
	);
}
