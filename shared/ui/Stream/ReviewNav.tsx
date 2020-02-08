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
import { GetReviewRequestType } from "@codestream/protocols/agent";
import { saveReviews } from "@codestream/webview/store/reviews/actions";
import { CodeStreamState } from "../store";
import { getReview } from "../store/reviews/reducer";
import { MinimumWidthCard } from "./Codemark/BaseCodemark";
import SearchResult from "./SearchResult";
import { InlineMenu } from "../src/components/controls/InlineMenu";
import { fetchThread, setReviewStatus, setUserPreference, createPost } from "./actions";

const ReviewActions = styled.div`
	width: 100%;
	height: 55px;
	position: fixed;
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
`;

const Nav = styled.div`
	position: fixed;
	top: 10px;
	right: 10px;
	z-index: 26;
	button {
		margin-left: 10px;
	}
`;

export type Props = React.PropsWithChildren<{
	filename: string;
	reviewId: string;
}>;

export function ReviewNav(props: Props) {
	const dispatch = useDispatch();
	const [notFound, setNotFound] = React.useState(false);
	const review = useSelector((state: CodeStreamState) => {
		return getReview(state.reviews, props.reviewId);
	});

	const pauseReview = async () => {
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
					<Button variant="secondary" onClick={reopen}>
						Reopen
					</Button>
				);
		}
	};

	if (notFound) return <MinimumWidthCard>This review was not found</MinimumWidthCard>;

	const changeMenu = [{ label: "foo.js", key: "foo.js", action: () => {} }];
	let title = props.filename + "";
	return (
		<>
			<PanelHeader title={title} position="fixed" className="active-review">
				<div style={{ opacity: 0.6 }}>
					<InlineMenu items={changeMenu}>Reviewing change #5 of 17 in file #3 of 7</InlineMenu>
				</div>
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
				<div style={{ textAlign: "left", flexGrow: 2 }}>
					{review && <SearchResult result={review} />}
				</div>
				<Button variant="secondary" onClick={pauseReview}>
					Pause
				</Button>
				{statusButtons()}
			</ReviewActions>
		</>
	);
}
