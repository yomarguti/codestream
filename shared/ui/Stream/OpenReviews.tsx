import React from "react";
import { useDispatch, useSelector } from "react-redux";
import * as reviewSelectors from "../store/reviews/reducer";
import * as userSelectors from "../store/users/reducer";
import { CodeStreamState } from "../store";
import { Row, IssueRows } from "./CrossPostIssueControls/IssueDropdown";
import Icon from "./Icon";
import { MarkdownText } from "./MarkdownText";
import { Headshot } from "../src/components/Headshot";
import { H4 } from "./StatusPanel";
import { setCurrentReview } from "../store/context/actions";
import { useDidMount } from "../utilities/hooks";
import { bootstrapReviews } from "../store/reviews/actions";

export function OpenReviews() {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const { session, users } = state;

		const currentUserId = session.userId!;
		const teammates = userSelectors.getTeamMates(state);
		const reviews = reviewSelectors.getByStatusAndReviewer(state, "open", currentUserId);

		return {
			reviews,
			currentUserId,
			teammates,
			currentUsername: users[session.userId!].username
		};
	});

	const reviewsState = useSelector((state: CodeStreamState) => state.reviews);

	useDidMount(() => {
		if (!reviewsState.bootstrapped) {
			dispatch(bootstrapReviews());
		}
	});

	const { reviews, teammates } = derivedState;

	if (reviews.length == 0) return null;
	return (
		<IssueRows>
			<H4 style={{ paddingLeft: "20px" }}>Open Reviews</H4>
			{reviews.map(review => {
				const creator = teammates.find(user => user.id === review.creatorId);
				return (
					<Row onClick={() => dispatch(setCurrentReview(review.id))}>
						<div>
							<Icon name="review" />
						</div>
						<div>
							<MarkdownText text={review.title} excludeParagraphWrap />
							<MarkdownText text={review.text} excludeParagraphWrap className="subtle" />
						</div>
						<div className="icons">
							<Headshot person={creator} />
						</div>
					</Row>
				);
			})}
		</IssueRows>
	);
}
