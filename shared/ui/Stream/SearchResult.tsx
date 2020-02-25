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
import { Marker } from "./Marker";
import { ChangesetFileList } from "./Review/ChangesetFileList";

const RootTR = styled.tr`
	margin: 0;
	&.archived td {
		opacity: 0.5;
	}
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
			display: inline-block;
			transform: scale(1.25);
		}
	}
	// title & info
	td:nth-child(2) {
		vertical-align: top;
		padding: 5px;
	}
	// headshots (which have right padding)
	td:nth-child(3) {
		text-align: left;
		padding: 5px 0 0 0;
	}
	// comments
	td:nth-child(4) {
		white-space: nowrap;
		text-align: center;
		padding: 5px 10px 5px 0;
	}
	td {
		@media only screen and (max-width: 430px) {
			font-size: 12px;
			//$//{HeadshotName} {
			//	padding-right: 5px;
			//}
			.headshot-name {
				display: none;
			}
		}
		@media only screen and (max-width: 350px) {
			font-size: 11px;
		}
		@media only screen and (max-width: 270px) {
			font-size: 10px;
		}
	}
`;

const Title = styled.div`
	p {
		display: inline;
		margin: 0;
	}
	.title {
		font-size: larger;
	}
	.details {
		opacity: 0.5;
	}
`;

const Tip = styled.div`
	max-width: 30em;
	.code.prettyprint {
		max-width: 30em !important;
		overflow: auto;
		border: 1px solid var(--base-border-color);
		background: var(--base-background-color);
	}
	p {
		display: inline;
		margin: 0;
	}
`;

interface Props {
	result: ReviewPlus | CodemarkPlus;
	titleOnly?: boolean;
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

	const buildTip = () => {
		if (isCSReview(result)) {
			return (
				<>
					<ChangesetFileList review={result} />
				</>
			);
		} else {
			// @ts-ignore
			const markers = result.markers || [];
			return (
				<Tip>
					<span dangerouslySetInnerHTML={{ __html: titleHTML }} />
					{markers.map(marker => (
						<Marker marker={marker} />
					))}
				</Tip>
			);
		}
	};

	const type = isCSReview(result) ? "review" : result.type;

	let titleHTML = markdownify(
		type === "comment" ? (result.text || "").substr(0, 80) : result.title
	);
	if (props.query) {
		const matchQueryRegexp = new RegExp(props.query, "gi");
		titleHTML = titleHTML.replace(matchQueryRegexp, "<u><b>$&</b></u>");
	}

	const assignees = (isCSReview(result) ? result.reviewers : result.assignees) || [];
	if (result.title == "refactor") console.log("ASSIGNEES ARE: ", assignees, " for ", result);

	let icon;
	let titleTip = buildTip(); // = result.text ? <div style={{ maxWidth: "25em" }}>{result.text}</div> : undefined;
	let createdVerb = "Opened";
	switch (type) {
		case "review":
			icon = "review";
			break;
		case "issue":
			icon = "issue";
			break;
		default:
			icon = "comment";
			createdVerb = "Posted";
			break;
	}

	// @ts-ignore
	const isArchived = isCSReview(result) ? false : result.pinned ? false : true;

	const title = (
		<Tooltip title={titleTip} placement="top" delay={1}>
			<Title>
				<div className="title">
					<span dangerouslySetInnerHTML={{ __html: titleHTML }} />
					&nbsp;
					{(result.tags || []).map(tagId => {
						const tag = derivedState.teamTagsHash[tagId];
						return tag ? <Tag tag={tag} /> : null;
					})}
				</div>

				<div className="details">
					{createdVerb} <Timestamp relative time={result.createdAt} /> by{" "}
					{derivedState.usernames[result.creatorId]}{" "}
					{result.status && <>&middot; {result.status} </>}
					{isArchived && <>&middot; archived </>}
				</div>
			</Title>
		</Tooltip>
	);

	if (props.titleOnly) return title;

	return (
		<RootTR onClick={selectResult} className={isArchived ? "archived" : ""}>
			<td>
				<Icon name={icon} />
			</td>
			<td>{title}</td>
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
		</RootTR>
	);
}
