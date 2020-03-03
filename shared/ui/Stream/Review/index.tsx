import React from "react";
import cx from "classnames";
import {
	CardBody,
	CardProps,
	getCardProps,
	CardFooter,
	CardBanner
} from "@codestream/webview/src/components/Card";
import { CodemarkPlus, CheckReviewPreconditionsRequestType } from "@codestream/protocols/agent";
import {
	MinimumWidthCard,
	Header,
	AuthorInfo,
	Title,
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
import { CSUser, CSReview, CodemarkType, CodemarkStatus } from "@codestream/protocols/api";
import { CodeStreamState } from "@codestream/webview/store";
import { useSelector, useDispatch, shallowEqual } from "react-redux";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import { capitalize, replaceHtml, emptyArray, mapFilter } from "@codestream/webview/utils";
import { useDidMount } from "@codestream/webview/utilities/hooks";
import { HostApi } from "../..";
import { deleteReview, fetchReview } from "@codestream/webview/store/reviews/actions";
import {
	setActiveReview,
	setCurrentReview,
	setCurrentCodemark
} from "@codestream/webview/store/context/actions";
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
import { createPost, setReviewStatus, setCodemarkStatus } from "../actions";
import { getThreadPosts } from "@codestream/webview/store/posts/reducer";
import { DropdownButton } from "./DropdownButton";
import Tag from "../Tag";
import { RepliesToPost } from "../Posts/RepliesToPost";
import { ChangesetFileList } from "./ChangesetFileList";
import Menu from "../Menu";
import { confirmPopup } from "../Confirm";
import { Checkbox } from "@codestream/webview/src/components/Checkbox";
import { createCodemark } from "@codestream/webview/store/codemarks/actions";
import { getReviewChangeRequests } from "@codestream/webview/store/codemarks/reducer";
import { Link } from "../Link";
import { MarkdownText } from "../MarkdownText";
import { Dispatch } from "@codestream/webview/store/common";
import { Loading } from "@codestream/webview/Container/Loading";
import Timestamp from "../Timestamp";
import { TourTip } from "@codestream/webview/src/components/TourTip";

export interface BaseReviewProps extends CardProps {
	review: CSReview;
	author: CSUser;
	repoInfo: { repoName: string; branch: string }[];
	headerError?: string;
	canStartReview?: boolean;
	currentUserId?: string;
	collapsed?: boolean;
	isFollowing?: boolean;
	reviewers?: CSUser[];
	tags?: { id: string }[];
	changeRequests?: CodemarkPlus[];
	renderFooter?: (
		footer: typeof CardFooter,
		inputContainer?: typeof ComposeWrapper
	) => React.ReactNode;
	renderMenu?: (target: any, onClose: () => void) => React.ReactNode;
	filesTip?: any;
}

const Clickable = styled(Link)`
	text-decoration: none !important;
	:hover {
		text-decoration: underline !important;
	}
`;

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
	.icon {
		margin-right: 5px;
	}
	.icon:not(:first-child) {
		margin-left: 20px;
	}
`;

export const ExpandedAuthor = styled.div`
	width: 100%;
	margin-bottom: 8px;
	color: var(--text-color-subtle);
	// opacity: 0.5;
	button {
		margin: 5px 5px 5px 0;
	}
`;

export const ReviewHeader = styled.div`
	width: 100%;
	margin-bottom: 3px;
	display: flex;
	align-items: flex-start;
	font-size: 13px;
	.icon.type {
		display: inline-block;
		transform: scale(1.25);
		padding: 3px 8px 3px 3px;
	}
	button {
		margin-left: 10px;
	}
`;

const ReviewTitle = styled.div`
	font-size: larger;
	flex-grow: 10;
`;

export const Description = styled.div`
	margin-bottom: 15px;
`;

const translateStatus = (status: string) => {
	if (status === "closed") return "Approved";

	return capitalize(status);
};

const BaseReview = (props: BaseReviewProps) => {
	const { review } = props;

	const dispatch = useDispatch();
	const [menuState, setMenuState] = React.useState<{ open: boolean; target?: any }>({
		open: false,
		target: undefined
	});

	const hasTags = props.tags && props.tags.length > 0;
	const hasReviewers = props.reviewers != null && props.reviewers.length > 0;
	const hasChangeRequests = props.changeRequests != null && props.changeRequests.length > 0;
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

	const approve = () => {
		if (hasChangeRequests && props.changeRequests!.find(r => r.status !== "closed"))
			confirmPopup({
				title: "Are you sure?",
				message: "This review has open change requests.",
				centered: true,
				buttons: [
					{ label: "Cancel", className: "control-button" },
					{
						label: "Approve Anyway",
						className: "success",
						wait: true,
						action: () => {
							dispatch(setReviewStatus(props.review.id, "closed"));
						}
					}
				]
			});
		else dispatch(setReviewStatus(props.review.id, "closed"));
	};

	const reject = () => dispatch(setReviewStatus(props.review.id, "rejected"));

	const reopen = () => dispatch(setReviewStatus(props.review.id, "open"));

	const startReview = () => dispatch(setCurrentReview(props.review.id));

	const renderedHeaderActions = (() => {
		if (!props.collapsed) return null;

		const approveItem = { label: "Approve", action: approve };
		const reviewItem = { label: "Review Changes", action: startReview };
		const rejectItem = { label: "Reject", action: reject };
		const reopenItem = { label: "Reopen", action: reopen };

		if (props.review.status === "open")
			return (
				<DropdownButton size="compact" items={[reviewItem, approveItem, rejectItem]}>
					Open
				</DropdownButton>
			);
		if (props.review.status === "closed")
			return (
				<DropdownButton size="compact" variant="secondary" items={[reopenItem]}>
					Approved
				</DropdownButton>
			);
		if (props.review.status === "rejected")
			return (
				<DropdownButton size="compact" variant="secondary" items={[reopenItem]}>
					Rejected
				</DropdownButton>
			);
	})();

	const renderedStartReview = (() => {
		if (!props.canStartReview) return null;
		// if (props.noActionButtons) return null;

		return (
			<DropdownButton
				size="compact"
				items={[
					{ label: "Visual Inspection", action: () => startReview() },
					{
						label: (
							<>
								Create working tree &nbsp;
								<Icon name="info" title="FIXME -- explain how this works" placement="bottomRight" />
							</>
						),
						action: () => dispatch(setReviewStatus(props.review.id, "rejected"))
					}
				]}
			>
				Start Review
			</DropdownButton>
		);
	})();

	return (
		<MinimumWidthCard {...getCardProps(props)} noCard={!props.collapsed}>
			{props.headerError && (
				<CardBanner>
					<div className="color-warning" style={{ display: "flex" }}>
						<Icon name="alert" />
						<div style={{ paddingLeft: "10px" }}>{props.headerError}</div>
					</div>
				</CardBanner>
			)}
			<CardBody>
				<ReviewHeader>
					<Icon name="review" className="type" />
					<ReviewTitle>
						<HeaderActions>
							{renderedHeaderActions}
							{renderedMenu}
							{kebabIcon}
						</HeaderActions>
						<MarkdownText text={review.title} />
					</ReviewTitle>
				</ReviewHeader>

				{!props.collapsed && (
					<ExpandedAuthor>
						Opened
						<Timestamp relative time={props.review.createdAt} /> by {props.author.username}
					</ExpandedAuthor>
				)}

				<MetaSection>
					{props.review.text && (
						<Description>
							<MarkdownText text={props.review.text} />
						</Description>
					)}
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
					{false && (
						<Meta>
							<MetaLabel>Status</MetaLabel>
							<MetaDescription>
								<MarkdownText text={translateStatus(review.status)} />
							</MetaDescription>
						</Meta>
					)}
					{!props.collapsed && hasChangeRequests && (
						<Meta>
							<MetaLabel>Change Requests</MetaLabel>
							<MetaDescriptionForAssignees>
								{props.changeRequests!.map(codemark => {
									const text = codemark.title || codemark.text;
									const formattedText = text.length > 80 ? `${text.substring(0, 77)}...` : text;

									return (
										<MetaAssignee key={codemark.id}>
											<Checkbox
												name={codemark.id}
												checked={codemark.status === CodemarkStatus.Closed}
												onChange={value => {
													dispatch(setCodemarkStatus(codemark.id, value ? "closed" : "open"));
												}}
											/>
											<Clickable
												onClick={() => {
													dispatch(setCurrentReview());
													dispatch(setCurrentCodemark(codemark.id));
												}}
											>
												<MarkdownText text={formattedText} />
											</Clickable>
										</MetaAssignee>
									);
								})}
							</MetaDescriptionForAssignees>
						</Meta>
					)}
					{!props.collapsed && (
						<Meta>
							<MetaLabel>Repository</MetaLabel>
							<MetaDescription>
								<MetaDescriptionForAssignees>
									{props.repoInfo.map(r => (
										<MetaRepoInfo key={r.repoName}>
											<RepoInfo>
												<Icon name="repo" /> {r.repoName}
												<Icon name="git-branch" /> {r.branch}
											</RepoInfo>
										</MetaRepoInfo>
									))}
								</MetaDescriptionForAssignees>
							</MetaDescription>
						</Meta>
					)}
					{!props.collapsed && (
						<TourTip title={props.filesTip} placement="top">
							<Meta id="changed-files">
								<MetaLabel>Changed Files</MetaLabel>
								<MetaDescriptionForAssignees>
									<ChangesetFileList review={review} noOnClick={!props.canStartReview} />
								</MetaDescriptionForAssignees>
							</Meta>
						</TourTip>
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
							placement="bottomLeft"
							align={{ offset: [-18, 4] }}
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
							placement="bottom"
							align={{ offset: [0, 4] }}
						>
							<span>
								<Headshot person={reviewer} size={18} />
							</span>
						</Tooltip>
					))}
				{props.review.numReplies > 0 && (
					<Tooltip title="Show replies" placement="bottom">
						<span className="detail-icon">
							<Icon name="comment" /> {props.review.numReplies}
						</span>
					</Tooltip>
				)}
			</MetaSectionCollapsed>
		</>
	);
};

const ReplyInput = (props: { parentPostId: string; streamId: string }) => {
	const dispatch = useDispatch<Dispatch>();
	const [text, setText] = React.useState("");
	const [isChangeRequest, setIsChangeRequest] = React.useState(false);
	const [isLoading, setIsLoading] = React.useState(false);
	const teamMates = useSelector((state: CodeStreamState) => getTeamMates(state));

	const submit = async () => {
		// don't create empty replies
		if (text.length === 0) return;

		setIsLoading(true);
		if (isChangeRequest) {
			await dispatch(
				createCodemark({
					text: replaceHtml(text)!,
					parentPostId: props.parentPostId,
					type: CodemarkType.Comment,
					codeBlocks: [],
					assignees: [],
					relatedCodemarkIds: [],
					accessMemberIds: [],
					isChangeRequest: true,
					tags: []
				})
			);
		} else {
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
	"collapsed" | "hoverEffect" | "onClick" | "className" | "renderFooter" | "filesTip"
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

	const [canStartReview, setCanStartReview] = React.useState(false);
	const [preconditionError, setPreconditionError] = React.useState("");

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

	const changeRequests = useSelector((state: CodeStreamState) =>
		getReviewChangeRequests(state, review)
	);

	React.useEffect(() => {
		// don't check preconditions if we're looking at the collapsed version of the
		// review (in the feed), but rather only when expanded (details view)
		if (props.collapsed) return;

		const checkPreconditions = async () => {
			let response = await HostApi.instance.send(CheckReviewPreconditionsRequestType, {
				reviewId: review.id
			});
			if (!response.success && response.error) setPreconditionError(response.error);
			else setCanStartReview(true);
		};
		checkPreconditions();
	}, [review]);

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
			changeRequests={changeRequests}
			isFollowing={derivedState.userIsFollowing}
			reviewers={derivedState.reviewers}
			currentUserId={derivedState.currentUser.id}
			renderFooter={renderFooter}
			headerError={preconditionError}
			canStartReview={canStartReview}
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

	const dispatch = useDispatch<Dispatch>();
	const review = useSelector((state: CodeStreamState) => {
		return getReview(state.reviews, id);
	});
	const [notFound, setNotFound] = React.useState(false);

	useDidMount(() => {
		let isValid = true;

		if (review == null) {
			dispatch(fetchReview(id))
				.then(result => {
					if (!isValid) return;
					if (result == null) setNotFound(true);
				})
				.catch(() => setNotFound(true));
		}

		return () => {
			isValid = false;
		};
	});

	if (notFound) return <MinimumWidthCard>This review was not found</MinimumWidthCard>;

	if (review == null)
		return (
			<DelayedRender>
				<Loading />
			</DelayedRender>
		);

	return <ReviewForReview review={review} {...otherProps} />;
};

export const Review = (props: ReviewProps) => {
	if (isPropsWithId(props)) return <ReviewForId {...props} />;
	return <ReviewForReview {...props} />;
};
