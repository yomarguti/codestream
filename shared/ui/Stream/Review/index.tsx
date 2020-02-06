import React from "react";
import cx from "classnames";
import { CardBody, CardProps, getCardProps } from "@codestream/webview/src/components/Card";
import { GetReviewRequestType } from "@codestream/protocols/agent";
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
	MetaSectionCollapsed,
	HeaderActions,
	ActionButton,
	MetaDescriptionForAssignees,
	MetaAssignee
} from "../Codemark/BaseCodemark";
import { Headshot } from "@codestream/webview/src/components/Headshot";
import { CSUser, CSReviewChangeset, CSReview } from "@codestream/protocols/api";
import { CodeStreamState } from "@codestream/webview/store";
import { useSelector, useDispatch } from "react-redux";
import { useMarkdownifyToHtml } from "../Markdowner";
import Icon from "../Icon";
import { SmartFormattedList } from "../SmartFormattedList";
import Tooltip from "../Tooltip";
import { capitalize, emptyArray } from "@codestream/webview/utils";
import { useDidMount } from "@codestream/webview/utilities/hooks";
import { HostApi } from "../..";
import { saveReviews } from "@codestream/webview/store/reviews/actions";
import { DelayedRender } from "@codestream/webview/Container/DelayedRender";
import { ChangesetFile } from "./ChangesetFile";
import { getReview } from "@codestream/webview/store/reviews/reducer";
import { ReviewShowDiffRequestType } from "@codestream/protocols/webview";
import MessageInput from "../MessageInput";
import styled from "styled-components";
import Button from "../Button";

export interface BaseReviewProps extends CardProps {
	review: CSReview;
	author: CSUser;
	repoNames: string[];
	currentUserId?: string;
	collapsed?: boolean;
	isFollowing?: boolean;
	reviewers?: CSUser[];
	renderReplyInput?: () => any;
}

const ComposeWrapper = styled.div.attrs(() => ({
	className: "compose codemark-compose"
}))`
	&&& {
		padding: 0 !important;
	}
`;

const BaseReview = (props: BaseReviewProps) => {
	const { review } = props;

	const markdownifyToHtml = useMarkdownifyToHtml();
	const hasReviewers = props.reviewers != null && props.reviewers.length > 0;

	const changedFiles = React.useMemo(() => {
		const files: any[] = [];
		for (let changeset of review.reviewChangesets) {
			files.push(
				...changeset.modifiedFiles.map(f => (
					<ChangesetFile
						onClick={e => {
							e.preventDefault();
							HostApi.instance.send(ReviewShowDiffRequestType, {
								reviewId: review.id,
								repoId: changeset.repoId,
								path: f.file
							});
						}}
						key={f.file}
						{...f}
					/>
				))
			);
		}
		return files;
	}, [props.review]);

	return (
		<MinimumWidthCard {...getCardProps(props)}>
			<CardBody>
				<Header>
					<AuthorInfo>
						<Headshot person={props.author} /> {props.author.username}{" "}
						<StyledTimestamp time={props.review.createdAt} />
					</AuthorInfo>
					{props.collapsed && (
						<HeaderActions>
							<ActionButton
								onClick={e => {
									e.preventDefault();
								}}
							>
								Review Changes
							</ActionButton>
						</HeaderActions>
					)}
				</Header>
				<Title>
					<Text
						dangerouslySetInnerHTML={{
							__html: markdownifyToHtml(review.title)
						}}
					/>
				</Title>
				<MetaSection>
					{!props.collapsed && hasReviewers && (
						<Meta>
							<MetaLabel>Reviewers</MetaLabel>
							<MetaDescriptionForAssignees>
								{props.reviewers!.map(reviewer => (
									<MetaAssignee key={reviewer.id}>
										<Headshot person={reviewer as any} size={18} />
										<span
											className={cx({
												"at-mention me": reviewer.id === props.currentUserId
											})}
										>
											{reviewer.username}
										</span>
									</MetaAssignee>
								))}
							</MetaDescriptionForAssignees>
						</Meta>
					)}
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
					{!props.collapsed && (
						<Meta>
							<MetaLabel>Changed Files</MetaLabel>
							<MetaDescriptionForAssignees>{changedFiles}</MetaDescriptionForAssignees>
						</Meta>
					)}
				</MetaSection>
				{props.collapsed && renderMetaSectionCollapsed(props)}
				{!props.collapsed && props.renderReplyInput != null && (
					<ComposeWrapper>{props.renderReplyInput()}</ComposeWrapper>
				)}
			</CardBody>
		</MinimumWidthCard>
	);
};

const renderMetaSectionCollapsed = (props: BaseReviewProps) => {
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

const ReplyInput = (props: {}) => {
	const [text, setText] = React.useState("");
	const submit = () => {};

	return (
		<>
			<MetaLabel>Add Reply</MetaLabel>
			<MessageInput
				text={text}
				placeholder="Reply..."
				onChange={value => {
					setText(value);
				}}
			/>
			<div style={{ display: "flex" }}>
				<div style={{ opacity: 0.4, paddingTop: "3px" }}>Markdown is supported</div>
				<div style={{ textAlign: "right", flexGrow: 1 }}>
					<Tooltip
						content={
							<span>
								Submit Reply
								<span className="keybinding extra-pad">
									{navigator.appVersion.includes("Macintosh") ? "⌘" : "Alt"} ENTER
								</span>
							</span>
						}
						placement="bottom"
						delay={1}
					>
						<Button
							style={{
								// fixed width to handle the isLoading case
								width: "80px",
								margin: "10px 0",
								float: "right"
							}}
							className={cx("control-button", { cancel: text.length === 0 })}
							type="submit"
							onClick={submit}
						>
							Submit
						</Button>
					</Tooltip>
				</div>
			</div>
		</>
	);
};

type FromBaseReviewProps = Pick<
	BaseReviewProps,
	"collapsed" | "hoverEffect" | "onClick" | "className"
>;

interface PropsWithId extends FromBaseReviewProps {
	id: string;
}

interface PropsWithReview extends FromBaseReviewProps {
	review: CSReview;
}

function isPropsWithId(props: PropsWithId | PropsWithReview): props is PropsWithId {
	return (props as any).id != undefined;
}

export type ReviewProps = PropsWithId | PropsWithReview;

const ReviewForReview = (props: PropsWithReview) => {
	const { review, ...baseProps } = props;

	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		return {
			currentUserId: state.session.userId,
			author: state.users[props.review.creatorId],
			repos: state.repos,
			userIsFollowing: (props.review.followerIds || []).includes(state.session.userId!),
			reviewers:
				props.review.reviewers != null ? props.review.reviewers.map(id => state.users[id]) : []
			// changesets: getChangesets(state.reviews, review.id)
		};
	});

	// useDidMount(() => {
	// 	if (props.collapsed !== true && derivedState.changesets == null) {
	// 		dispatch(fetchChangesets(review.id));
	// 	}
	// });

	let repoNames = new Set<string>();

	for (let changeset of review.reviewChangesets) {
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
			currentUserId={derivedState.currentUserId}
			renderReplyInput={() => <ReplyInput />}
		/>
	);
};

const ReviewForId = (props: PropsWithId) => {
	const { id, ...otherProps } = props;

	const dispatch = useDispatch();
	const review = useSelector((state: CodeStreamState) => {
		return getReview(state.reviews, id);
	});
	const [notFound, setNotFound] = React.useState(false);

	useDidMount(() => {
		let isValid = true;
		const fetchReview = async () => {
			try {
				const response = await HostApi.instance.send(GetReviewRequestType, { reviewId: id });
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

	if (notFound) return <MinimumWidthCard>This review was not found</MinimumWidthCard>;

	return (
		<DelayedRender>
			{review != null && <ReviewForReview review={review} {...otherProps} />}
		</DelayedRender>
	);
};

export const Review = (props: ReviewProps) => {
	if (isPropsWithId(props)) return <ReviewForId {...props} />;
	return <ReviewForReview {...props} />;
};
