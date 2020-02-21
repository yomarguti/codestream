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
	MetaAssignee,
	MetaRow,
	MetaDescriptionForTags,
	KebabIcon
} from "../Codemark/BaseCodemark";
import { Headshot } from "@codestream/webview/src/components/Headshot";
import { CSUser, CSReview, CodemarkType } from "@codestream/protocols/api";
import { CodeStreamState } from "@codestream/webview/store";
import { useSelector, useDispatch, shallowEqual } from "react-redux";
import { useMarkdownifyToHtml } from "../Markdowner";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import { capitalize, replaceHtml, emptyArray, mapFilter } from "@codestream/webview/utils";
import { useDidMount } from "@codestream/webview/utilities/hooks";
import { HostApi } from "../..";
import { saveReviews, deleteReview } from "@codestream/webview/store/reviews/actions";
import { setActiveReview, setCurrentReview } from "@codestream/webview/store/context/actions";
import { DelayedRender } from "@codestream/webview/Container/DelayedRender";
import { getReview } from "@codestream/webview/store/reviews/reducer";
import MessageInput from "../MessageInput";
import styled from "styled-components";
import Button from "../Button";
import {
	getTeamMates,
	findMentionedUserIds,
	getTeamTagsHash
} from "@codestream/webview/store/users/reducer";
import { createPost, setReviewStatus } from "../actions";
import { getThreadPosts } from "@codestream/webview/store/posts/reducer";
import { DropdownButton } from "./DropdownButton";
import Tag from "../Tag";
import { RepliesToPost } from "../Posts/RepliesToPost";
import { ChangesetFileList } from "./ChangesetFileList";
import Menu from "../Menu";
import { confirmPopup } from "../Confirm";
import { Checkbox } from "@codestream/webview/src/components/Checkbox";
import { createCodemark } from "@codestream/webview/store/codemarks/actions";

export interface BaseReviewProps extends CardProps {
	review: CSReview;
	author: CSUser;
	repoInfo: { repoName: string; branch: string }[];
	currentUserId?: string;
	collapsed?: boolean;
	isFollowing?: boolean;
	reviewers?: CSUser[];
	tags?: { id: string }[];
	renderFooter?: (
		footer: typeof CardFooter,
		inputContainer?: typeof ComposeWrapper
	) => React.ReactNode;
	renderMenu?: (target: any, onClose: () => void) => React.ReactNode;
}

const ComposeWrapper = styled.div.attrs(() => ({
	className: "compose codemark-compose"
}))`
	&&& {
		padding: 0 !important;
	}
`;

const MetaRepoInfo = styled.div`
	display: flex;
	flex-direction: column;
	&:not(:last) {
		margin-bottom: 2px;
	}
`;

const RepoInfo = styled.div`
	display: flex;
	*:first-child {
		margin-right: 5px;
	}
`;

const BaseReview = (props: BaseReviewProps) => {
	const { review } = props;

	const dispatch = useDispatch();
	const markdownifyToHtml = useMarkdownifyToHtml();
	const [menuState, setMenuState] = React.useState<{ open: boolean; target?: any }>({
		open: false,
		target: undefined
	});

	const hasTags = props.tags && props.tags.length > 0;
	const hasReviewers = props.reviewers != null && props.reviewers.length > 0;
	const renderedFooter = props.renderFooter && props.renderFooter(CardFooter, ComposeWrapper);
	const renderedMenu =
		props.renderMenu &&
		menuState.open &&
		props.renderMenu(menuState.target, () => setMenuState({ open: false }));
	const kebabIcon = props.renderMenu && (
		<KebabIcon
			onClickCapture={e => {
				e.preventDefault();
				e.stopPropagation();
				if (menuState.open) {
					setMenuState({ open: false });
				} else {
					setMenuState({ open: true, target: e.currentTarget });
				}
			}}
		>
			<Icon name="kebab-vertical" className="clickable" />
		</KebabIcon>
	);

	const renderedHeaderActions = (() => {
		if (props.collapsed) {
			if (props.review.status === "open")
				return (
					<ActionButton
						onClick={e => {
							e.preventDefault();
						}}
					>
						Review Changes
					</ActionButton>
				);
			else return;
		} else {
			if (props.review.status !== "open")
				return (
					<ActionButton onClick={() => dispatch(setReviewStatus(props.review.id, "open"))}>
						Reopen
					</ActionButton>
				);
			return (
				<>
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
				</>
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
					<HeaderActions>
						{renderedHeaderActions}
						{renderedMenu}
						{kebabIcon}
					</HeaderActions>
				</Header>
				<Title>
					<MarkdownText
						dangerouslySetInnerHTML={{
							__html: markdownifyToHtml(review.title)
						}}
					/>
				</Title>
				<MetaSection>
					{!props.collapsed && (hasTags || hasReviewers) && (
						<MetaRow>
							{hasTags && (
								<Meta>
									<MetaLabel>Tags</MetaLabel>
									<MetaDescriptionForTags>
										{props.tags!.map(tag => (
											<Tag tag={tag} key={tag.id} />
										))}
									</MetaDescriptionForTags>
								</Meta>
							)}
							{hasReviewers && (
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
						</MetaRow>
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
							<MarkdownText>
								<MetaDescriptionForAssignees>
									{props.repoInfo.map(r => (
										<MetaRepoInfo key={r.repoName}>
											<RepoInfo>
												<Icon name="repo" /> {r.repoName}
											</RepoInfo>
											<RepoInfo>
												<Icon name="git-branch" /> {r.branch}
											</RepoInfo>
										</MetaRepoInfo>
									))}
								</MetaDescriptionForAssignees>
							</MarkdownText>
						</MetaDescription>
					</Meta>
					{!props.collapsed && (
						<Meta>
							<MetaLabel>Changed Files</MetaLabel>
							<MetaDescriptionForAssignees>
								<ChangesetFileList review={review} />
							</MetaDescriptionForAssignees>
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
				{props.tags && props.tags.map(tag => <Tag tag={tag} key={tag.id} />)}
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
	const [isChangeRequest, setIsChangeRequest] = React.useState(false);
	const [isLoading, setIsLoading] = React.useState(false);
	const teamMates = useSelector((state: CodeStreamState) => getTeamMates(state));

	const submit = async () => {
		// don't create empty replies
		if (text.length === 0) return;

		setIsLoading(true);
		if (isChangeRequest) {
			// ignore the typescript warning that `await` isn't necessary below
			await dispatch(
				createCodemark({
					text: replaceHtml(text)!,
					parentPostId: props.parentPostId,
					type: CodemarkType.Comment,
					codeBlocks: [],
					assignees: [],
					relatedCodemarkIds: [],
					accessMemberIds: [],
					tags: []
				})
			);
		} else {
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
			setIsChangeRequest(false);
		}
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
				<div style={{ opacity: 0.4, paddingTop: "10px" }}>
					<Checkbox name="change-request" checked={isChangeRequest} onChange={setIsChangeRequest}>
						Change Request (require for approval)
					</Checkbox>
				</div>
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

	const dispatch = useDispatch();
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
			allUsers: state.users,
			teamTagsById: getTeamTagsHash(state)
		};
	}, shallowEqual);

	const tags = React.useMemo(
		() => (review.tags ? mapFilter(review.tags, id => derivedState.teamTagsById[id]) : emptyArray),
		[props.review, derivedState.teamTagsById]
	);

	const repoInfo = React.useMemo(() => {
		const reviewRepos = new Map<string, any>();

		for (let changeset of review.reviewChangesets) {
			const repo = derivedState.repos[changeset.repoId];
			if (repo && !reviewRepos.has(changeset.repoId))
				reviewRepos.set(changeset.repoId, { repoName: repo.name, branch: changeset.branch });
		}

		return [...reviewRepos.values()];
	}, [review, derivedState.repos]);

	const renderFooter =
		props.renderFooter ||
		((Footer, InputContainer) => {
			if (props.collapsed) return null;

			return (
				<Footer style={{ borderTop: "none", marginTop: 0 }}>
					{derivedState.replies.length > 0 && <MetaLabel>Activity</MetaLabel>}
					<RepliesToPost streamId={props.review.streamId} parentPostId={props.review.postId} />
					{InputContainer && (
						<InputContainer>
							<ReplyInput parentPostId={review.postId} streamId={review.streamId} />
						</InputContainer>
					)}
				</Footer>
			);
		});

	const menuItems = React.useMemo(() => {
		const items: any[] = [];

		if (review.creatorId === derivedState.currentUser.id)
			items.push({
				label: "Delete",
				action: () => {
					confirmPopup({
						title: "Are you sure?",
						message: "Deleting a review cannot be undone.",
						centered: true,
						buttons: [
							{ label: "Go Back", className: "control-button" },
							{
								label: "Delete Review",
								className: "delete",
								wait: true,
								action: () => {
									dispatch(deleteReview(review.id));
									dispatch(setCurrentReview());
								}
							}
						]
					});
				}
			});

		return items;
	}, [review]);

	return (
		<BaseReview
			{...baseProps}
			author={derivedState.author}
			review={props.review}
			repoInfo={repoInfo}
			tags={tags}
			isFollowing={derivedState.userIsFollowing}
			reviewers={derivedState.reviewers}
			currentUserId={derivedState.currentUser.id}
			renderFooter={renderFooter}
			renderMenu={
				menuItems.length > 0
					? (target, close) => <Menu target={target} action={close} items={menuItems} />
					: undefined
			}
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
