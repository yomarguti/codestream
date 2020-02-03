import React from "react";
import { CardBody, CardProps } from "@codestream/webview/src/components/Card";
import { ReviewPlus } from "@codestream/protocols/agent";
import {
	MinimumWidthCard,
	Header,
	AuthorInfo,
	StyledTimestamp,
	Title,
	Text,
	MetaSection,
	Meta,
	MetaLabel,
	MetaDescription,
	MetaSectionCollapsed
} from "../Codemark/BaseCodemark";
import { Headshot } from "@codestream/webview/src/components/Headshot";
import { CSUser } from "@codestream/protocols/api";
import { CodeStreamState } from "@codestream/webview/store";
import { useSelector } from "react-redux";
import { useMarkdownifyToHtml } from "../Markdowner";
import Icon from "../Icon";
import { SmartFormattedList } from "../SmartFormattedList";
import Tooltip from "../Tooltip";
import { capitalize } from "@codestream/webview/utils";

export interface BaseReviewProps extends CardProps {
	review: ReviewPlus;
	author: CSUser;
	repoNames: string[];
	collapsed?: boolean;
	isFollowing?: boolean;
	reviewers?: CSUser[];
}

const BaseReview = (props: BaseReviewProps) => {
	const { review } = props;
	const markdownifyToHtml = useMarkdownifyToHtml();

	return (
		<MinimumWidthCard>
			<CardBody>
				<Header>
					<AuthorInfo>
						<Headshot person={props.author} /> {props.author.username}{" "}
						<StyledTimestamp time={props.review.createdAt} />
					</AuthorInfo>
				</Header>
				<Title>
					<Text
						dangerouslySetInnerHTML={{
							__html: markdownifyToHtml(review.title)
						}}
					/>
				</Title>
				<MetaSection>
					<Meta>
						<MetaLabel>Description</MetaLabel>
						<MetaDescription>
							<Icon name="description" />
							<Text dangerouslySetInnerHTML={{ __html: markdownifyToHtml(props.review.text) }} />
						</MetaDescription>
					</Meta>
					<Meta>
						<MetaLabel>Status</MetaLabel>
						<MetaDescription>
							<Text>{capitalize(props.review.status)}</Text>
						</MetaDescription>
					</Meta>
					<Meta>
						<MetaLabel>Repositories</MetaLabel>
						<MetaDescription>
							<Icon name="repo" />
							<Text>
								<SmartFormattedList value={props.repoNames} />
							</Text>
						</MetaDescription>
					</Meta>
				</MetaSection>
				{props.collapsed && getCollapsedView(props)}
			</CardBody>
		</MinimumWidthCard>
	);
};

const getCollapsedView = (props: BaseReviewProps) => {
	return (
		<>
			<MetaSectionCollapsed>
				{props.isFollowing && (
					<span>
						<Icon
							className="detail-icon"
							title="You are following this review"
							placement="bottomRight"
							align={{ offset: [18, 4] }}
							name="eye"
						/>
					</span>
				)}
				{props.reviewers != null &&
					props.reviewers.map(reviewer => (
						<Tooltip
							key={reviewer.id}
							title={`${reviewer.username} is a reviewer`}
							placement="bottomRight"
							align={{ offset: [10, 4] }}
						>
							<span>
								<Headshot person={reviewer} size={18} />
							</span>
						</Tooltip>
					))}
			</MetaSectionCollapsed>
		</>
	);
};

type FromBaseReviewProps = Pick<
	BaseReviewProps,
	"review" | "collapsed" | "hoverEffect" | "onClick" | "className"
>;

export interface ReviewProps extends FromBaseReviewProps {}

export const Review = (props: ReviewProps) => {
	const { review, ...baseProps } = props;

	const derivedState = useSelector((state: CodeStreamState) => {
		return {
			author: state.users[props.review.creatorId],
			repos: state.repos,
			userIsFollowing: (props.review.followerIds || []).includes(state.session.userId!),
			reviewers:
				props.review.reviewers != null ? props.review.reviewers.map(id => state.users[id]) : []
		};
	});

	let repoNames = new Set<string>();

	for (let changeset of review.repoChangeset) {
		const repo = derivedState.repos[changeset.repoId];
		if (repo) repoNames.add(repo.name);
	}

	return (
		<BaseReview
			{...baseProps}
			author={derivedState.author}
			review={props.review}
			repoNames={[...repoNames]}
			isFollowing={derivedState.userIsFollowing}
			reviewers={derivedState.reviewers}
		/>
	);
};
