import React from "react";
import cx from "classnames";
import {
	CardBody,
	CardProps,
	getCardProps,
	CardFooter
} from "@codestream/webview/src/components/Card";
import { GetReviewRequestType } from "@codestream/protocols/agent";
import {
	MinimumWidthCard,
	Header,
	AuthorInfo,
	StyledTimestamp,
	Title,
	MarkdownText,
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
import { CSUser, CSReview } from "@codestream/protocols/api";
import { CodeStreamState } from "@codestream/webview/store";
import { useSelector, useDispatch, shallowEqual } from "react-redux";
import { useMarkdownifyToHtml } from "../Markdowner";
import Icon from "../Icon";
import { SmartFormattedList } from "../SmartFormattedList";
import Tooltip from "../Tooltip";
import { capitalize, replaceHtml, emptyArray } from "@codestream/webview/utils";
import { useDidMount } from "@codestream/webview/utilities/hooks";
import { HostApi } from "../..";
import { saveReviews } from "@codestream/webview/store/reviews/actions";
import { setActiveReview } from "@codestream/webview/store/context/actions";
import { DelayedRender } from "@codestream/webview/Container/DelayedRender";
import { ChangesetFile } from "./ChangesetFile";
import { getReview } from "@codestream/webview/store/reviews/reducer";
import { ReviewShowDiffRequestType } from "@codestream/protocols/webview";
import MessageInput from "../MessageInput";
import styled from "styled-components";
import Button from "../Button";
import { getTeamMates, findMentionedUserIds } from "@codestream/webview/store/users/reducer";
import { createPost, setReviewStatus } from "../actions";
import { getThreadPosts } from "@codestream/webview/store/posts/reducer";
import { Reply } from "../Posts/Reply";
import { DropdownButton } from "./DropdownButton";

export interface BaseReviewProps extends CardProps {
	review: CSReview;
	author: CSUser;
	repoNames: string[];
	currentUserId?: string;
	collapsed?: boolean;
	isFollowing?: boolean;
	reviewers?: CSUser[];
	renderReplyInput?: () => React.ReactNode;
	renderFooter?: (footer: typeof CardFooter) => React.ReactNode;
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

	const dispatch = useDispatch();

	const markdownifyToHtml = useMarkdownifyToHtml();
	const hasReviewers = props.reviewers != null && props.reviewers.length > 0;
	const renderedFooter = props.renderFooter && props.renderFooter(CardFooter);

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

	const renderedHeaderActions = (() => {
		if (props.collapsed) {
			if (props.review.status === "open")
				return (
					<HeaderActions>
						<ActionButton
							onClick={e => {
								e.preventDefault();
							}}
						>
							Review Changes
						</ActionButton>
					</HeaderActions>
				);
			else return;
		} else {
			if (props.review.status !== "open")
				return (
					<HeaderActions>
						<ActionButton onClick={() => dispatch(setReviewStatus(props.review.id, "open"))}>
							Reopen
						</ActionButton>
					</HeaderActions>
				);
			return (
				<HeaderActions>
					<DropdownButton
						items={[
							{
								label: "Review Changes",
								action: () => startReview()
							},
							{
								label: "Visual Inspection",
								action: () => startReview()
							},
							{
								label: (
									<>
										Create working tree &nbsp;
										<Icon
											name="info"
											title="FIXME -- explain how this works"
											placement="bottomRight"
										/>
									</>
								),
								action: () => dispatch(setReviewStatus(props.review.id, "rejected"))
							}
						]}
					/>
					<DropdownButton
						items={[
							{
								label: "Approve",
								action: () => dispatch(setReviewStatus(props.review.id, "closed"))
							},
							{
								label: "Reject",
								action: () => dispatch(setReviewStatus(props.review.id, "rejected"))
							}
						]}
					/>
				</HeaderActions>
			);
		}
	})();

	const startReview = () => {
		dispatch(setActiveReview(review.id));
	};

	return (
		<MinimumWidthCard {...getCardProps(props)}>
			<CardBody>
				<Header>
					<AuthorInfo>
						<Headshot person={props.author} /> {props.author.username}{" "}
						<StyledTimestamp time={props.review.createdAt} />
					</AuthorInfo>
					{renderedHeaderActions}
				</Header>
				<Title>
					<MarkdownText
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
					{props.review.text && (
						<Meta>
							<MetaLabel>Description</MetaLabel>
							<MetaDescription>
								<Icon name="description" />
								<MarkdownText
									dangerouslySetInnerHTML={{ __html: markdownifyToHtml(props.review.text) }}
								/>
							</MetaDescription>
						</Meta>
					)}
					<Meta>
						<MetaLabel>Status</MetaLabel>
						<MetaDescription>
							<MarkdownText>{capitalize(props.review.status)}</MarkdownText>
						</MetaDescription>
					</Meta>
					<Meta>
						<MetaLabel>Repositories</MetaLabel>
						<MetaDescription>
							<Icon name="repo" />
							<MarkdownText>
								<SmartFormattedList value={props.repoNames} />
							</MarkdownText>
						</MetaDescription>
					</Meta>
					{!props.collapsed && (
						<Meta>
							<MetaLabel>Changed Files</MetaLabel>
							<MetaDescriptionForAssignees>{changedFiles}</MetaDescriptionForAssignees>
						</Meta>
					)}
					{/*!props.collapsed && (
						<Meta>
							<MetaLabel>Commits</MetaLabel>
							<MetaDescription>{commits}</MetaDescription>
						</Meta>
					)*/}
				</MetaSection>
				{props.collapsed && renderMetaSectionCollapsed(props)}
				{!props.collapsed && props.renderReplyInput != null && (
					<ComposeWrapper>{props.renderReplyInput()}</ComposeWrapper>
				)}
			</CardBody>
			{renderedFooter}
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

const ReplyInput = (props: { parentPostId: string; streamId: string }) => {
	const dispatch = useDispatch();
	const [text, setText] = React.useState("");
	const [isLoading, setIsLoading] = React.useState(false);
	const teamMates = useSelector((state: CodeStreamState) => getTeamMates(state));

	const submit = async () => {
		// don't create empty replies
		if (text.length === 0) return;

		setIsLoading(true);
		// ignore the typescript warning that `await` isn't necessary below
		await dispatch(
			createPost(
				props.streamId,
				props.parentPostId,
				replaceHtml(text)!,
				null,
				findMentionedUserIds(teamMates, text),
				{
					entryPoint: "Review"
				}
			)
		);
		setIsLoading(false);
		setText("");
		// HostApi.instance.track("Replied to Review", {});
	};

	return (
		<>
			<MetaLabel>Add Reply</MetaLabel>
			<MessageInput
				multiCompose
				text={text}
				placeholder="Reply..."
				onChange={setText}
				onSubmit={submit}
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
							disabled={text.length === 0}
							onClick={submit}
							loading={isLoading}
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
	"collapsed" | "hoverEffect" | "onClick" | "className" | "renderFooter"
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

	const derivedState = useSelector((state: CodeStreamState) => {
		return {
			currentTeamId: state.context.currentTeamId,
			currentUser: state.users[state.session.userId!],
			author: state.users[props.review.creatorId],
			repos: state.repos,
			userIsFollowing: (props.review.followerIds || []).includes(state.session.userId!),
			reviewers:
				props.review.reviewers != null
					? props.review.reviewers.map(id => state.users[id])
					: emptyArray,
			teamMates: getTeamMates(state),
			replies: props.collapsed ? emptyArray : getThreadPosts(state, review.streamId, review.postId),
			allUsers: state.users
		};
	}, shallowEqual);

	let repoNames = React.useMemo(() => {
		const names = new Set<string>();

		for (let changeset of review.reviewChangesets) {
			const repo = derivedState.repos[changeset.repoId];
			if (repo) names.add(repo.name);
		}
		return [...names];
	}, [review, derivedState.repos]);

	const renderFooter =
		props.renderFooter ||
		(Footer => {
			if (props.collapsed) return null;
			if (derivedState.replies.length === 0) return null;

			return (
				<Footer style={{ borderTop: "none", marginTop: 0 }}>
					<MetaLabel>Activity</MetaLabel>
					{derivedState.replies
						.slice() // be sure to copy the array before reversing because `reverse` mutates the array
						.reverse()
						.map(reply => (
							<Reply
								key={reply.id}
								author={derivedState.allUsers[reply.creatorId]}
								post={reply as any}
							/>
						))}
				</Footer>
			);
		});

	return (
		<BaseReview
			{...baseProps}
			author={derivedState.author}
			review={props.review}
			repoNames={repoNames}
			isFollowing={derivedState.userIsFollowing}
			reviewers={derivedState.reviewers}
			currentUserId={derivedState.currentUser.id}
			renderReplyInput={() => (
				<ReplyInput parentPostId={review.postId} streamId={review.streamId} />
			)}
			renderFooter={renderFooter}
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
