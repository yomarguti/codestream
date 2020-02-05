import React from "react";
import styled from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import * as userSelectors from "../store/users/reducer";
import Icon from "./Icon";
import { ReviewPlus } from "../protocols/agent/agent.protocol.reviews";
import Tag from "./Tag";
import Timestamp from "./Timestamp";
import Tooltip from "./Tooltip";
import { CodeStreamState } from "../store";
import { markdownify } from "./Markdowner";

const Root = styled.div`
	padding: 5px 20px;
	margin: 0;
	font-size: larger;
	p {
		display: inline;
		margin: 0;
	}
`;

interface Props {
	review: ReviewPlus;
	query?: string;
	onClick?: Function;
}

export default function SearchResult(props: Props) {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		return {
			teamTagsHash: userSelectors.getTeamTagsHash(state),
			usernames: userSelectors.getUsernamesById(state)
		};
	});
	const { review } = props;
	let title = markdownify(review.title);
	if (props.query) {
		const matchQueryRegexp = new RegExp(props.query, "gi");
		title = title.replace(matchQueryRegexp, "<u><b>$&</b></u>");
	}

	return (
		<Root>
			<Icon name="checked-checkbox" />{" "}
			<Tooltip title="FOO">
				<span dangerouslySetInnerHTML={{ __html: title }} />
			</Tooltip>
			&nbsp;
			{(review.tags || []).map(tagId => {
				const tag = derivedState.teamTagsHash[tagId];
				return tag ? <Tag tag={tag} /> : null;
			})}
			<div style={{ opacity: 0.5, fontSize: "smaller", paddingLeft: "22px" }}>
				#12 opened <Timestamp relative time={review.createdAt} /> by{" "}
				{derivedState.usernames[review.creatorId]} &middot; {review.status}
			</div>
			{/*	FIXME <Review key={review.id} review={review} query={this.state.q} />*/}
		</Root>
	);
}
