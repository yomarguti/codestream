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
import { setCurrentReview, setCurrentCodemark } from "../store/context/actions";
import { HeadshotName } from "../src/components/HeadshotName";
import { CodemarkPlus } from "@codestream/protocols/agent";
import { isCSReview } from "../protocols/agent/api.protocol.models";

const Root = styled.tr`
	margin: 0;
	.title {
		cursor: pointer;
		font-size: larger;
	}
	.details {
		opacity: 0.5;
	}
	p {
		display: inline;
		margin: 0;
	}
	:hover {
		background: var(--app-background-color-hover);
	}
	td:nth-child(1) {
		vertical-align: top;
		padding: 8px 5px 5px 20px;
		width: 20px;
		.icon {
		}
	}
	td:nth-child(2) {
		vertical-align: top;
		padding: 5px;
	}
	td:nth-child(3) {
		text-align: left;
		padding: 5px 0 0 0;
	}
	td:nth-child(4) {
		white-space: nowrap;
		text-align: center;
		padding: 5px 20px 5px 5px;
	}
`;

interface Props {
	result: ReviewPlus | CodemarkPlus;
	query?: string;
	onClick?: Function;
}

export default function SearchResult(props: Props) {
	const { result } = props;
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		return {
			teamTagsHash: userSelectors.getTeamTagsHash(state),
			usernames: userSelectors.getUsernamesById(state)
		};
	});

	const selectResult = () => {
		if (isCSReview(result)) dispatch(setCurrentReview(result.id));
		else dispatch(setCurrentCodemark(result.id));
	};

	const type = isCSReview(result) ? "review" : result.type;

	let title = markdownify(type === "comment" ? result.text.substr(0, 80) : result.title);
	if (props.query) {
		const matchQueryRegexp = new RegExp(props.query, "gi");
		title = title.replace(matchQueryRegexp, "<u><b>$&</b></u>");
	}

	const assignees = (isCSReview(result) ? result.reviewers : result.assignees) || [];

	let icon;
	let createdVerb = "opened";
	switch (type) {
		case "review":
			icon = "code";
			break;
		case "issue":
			icon = "issue";
			break;
		default:
			icon = "comment";
			createdVerb = "posted";
			break;
	}

	return (
		<Root onClick={selectResult}>
			<td>
				<Icon name={icon} />
			</td>
			<td>
				<div className="title">
					<Tooltip title="FOO" placement="top">
						<span dangerouslySetInnerHTML={{ __html: title }} />
					</Tooltip>
					&nbsp;
					{(result.tags || []).map(tagId => {
						const tag = derivedState.teamTagsHash[tagId];
						return tag ? <Tag tag={tag} /> : null;
					})}
				</div>

				<div className="details">
					#12 {createdVerb} <Timestamp relative time={result.createdAt} /> by{" "}
					{derivedState.usernames[result.creatorId]}{" "}
					{result.status && <>&middot; {result.status}</>}
				</div>
			</td>
			<td>
				{assignees.map(id => (
					<HeadshotName id={id} />
				))}
			</td>
			<td>
				{result.numReplies > 0 && (
					<>
						<Icon name="comment" /> {result.numReplies}
					</>
				)}
			</td>
		</Root>
	);
}
