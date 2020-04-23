import React, { PropsWithChildren } from "react";
import cx from "classnames";
import {
	CardBody,
	CardProps,
	getCardProps,
	CardFooter,
	CardBanner
} from "@codestream/webview/src/components/Card";
import {
	CodemarkPlus,
	CheckReviewPreconditionsRequestType,
	FollowReviewRequestType
} from "@codestream/protocols/agent";
import {
	MinimumWidthCard,
	Header,
	MetaSection,
	Meta,
	MetaLabel,
	MetaDescription,
	MetaSectionCollapsed,
	HeaderActions,
	MetaDescriptionForAssignees,
	MetaAssignee,
	MetaRow,
	MetaDescriptionForTags,
	KebabIcon,
	BigTitle
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
import { setCurrentReview, setCurrentCodemark } from "@codestream/webview/store/context/actions";
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
import { ReviewForm } from "../ReviewForm";
import Timestamp from "../Timestamp";
import { Dispatch } from "@codestream/webview/store/common";
import { Loading } from "@codestream/webview/Container/Loading";
import { TourTip } from "@codestream/webview/src/components/TourTip";
import { SearchContext } from "../SearchContextProvider";
import { CommitList } from "./CommitList";
import { SharingModal } from "../SharingModal";
import {
	ShowPreviousChangedFileRequestType,
	ShowNextChangedFileRequestType
} from "@codestream/protocols/webview";
import { HeadshotName } from "@codestream/webview/src/components/HeadshotName";

export interface BaseReviewProps extends CardProps {
	review: CSReview;
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
	filesTip?: any;
	setIsEditing?: Function;
}

export interface BaseReviewHeaderProps {
	review: CSReview;
	collapsed?: boolean;
	isFollowing?: boolean;
	reviewers?: CSUser[];
	tags?: { id: string }[];
	changeRequests?: CodemarkPlus[];
	setIsEditing?: Function;
}

export interface BaseReviewMenuProps {
	review: CSReview;
	setIsEditing?: Function;
	globalNav?: boolean;
}

const Clickable = styled(Link)`
	display: inline-block;
	padding-top: 2px;
`;

const ComposeWrapper = styled.div.attrs(() => ({
	className: "compose codemark-compose"
}))`
	&&& {
		padding: 0 !important;
	}
	.message-input#input-div {
		max-width: none !important;
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
	span:not(:first-child) {
		padding-left: 20px;
	}
	span {
		display: inline-block;
	}
`;

export const ExpandedAuthor = styled.div`
	width: 100%;
	color: var(--text-color-subtle);
	white-space: normal;
`;

const ReviewTitle = styled.div`
	font-size: larger;
	flex-grow: 10;
`;

export const Description = styled.div`
	margin-bottom: 15px;
`;

const MetaCheckboxWithHoverIcon = styled.div`
	display: flex;
	.icon {
		margin: 3px 0 0 8px;
		display: none !important;
	}
	&:hover .icon {
		display: inline-block !important;
	}
`;

const MetaIcons = styled.span`
	.icon {
		margin-left: 5px;
	}
`;

const translateStatus = (status: string) => {
	if (status === "closed") return "Approved";

	return capitalize(status);
};

// if child props are passed in, we assume they are the action buttons/menu for the header
export const BaseReviewHeader = (props: PropsWithChildren<BaseReviewHeaderProps>) => {
	const { review } = props;
	const dispatch = useDispatch();

	const derivedState = useSelector((state: CodeStreamState) => {
		return {
			currentUserId: state.session.userId!
		};
	}, shallowEqual);

	const approve = () => {
		if (props.changeRequests && props.changeRequests!.find(r => r.status !== "closed"))
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
							dispatch(setReviewStatus(props.review.id, "approved"));
						}
					}
				]
			});
		else dispatch(setReviewStatus(props.review.id, "approved"));
	};

	const reject = () => dispatch(setReviewStatus(props.review.id, "rejected"));

	const reopen = () => dispatch(setReviewStatus(props.review.id, "open"));

	const startReview = () => dispatch(setCurrentReview(props.review.id));

	const renderedHeaderActions = (() => {
		const { collapsed, review } = props;
		if (!collapsed) return null;
		const { approvedBy = {} } = review;

		const approveItem = { icon: <Icon name="thumbsup" />, label: "Approve", action: approve };
		const unapproveItem = {
			icon: <Icon name="diff-removed" />,
			label: "Withdraw Approval",
			action: reopen
		};
		const reviewItem = {
			icon: <Icon name="review" />,
			label: "Review Changes",
			action: startReview
		};
		const rejectItem = { icon: <Icon name="thumbsdown" />, label: "Reject", action: reject };
		const reopenItem = { icon: <Icon name="reopen" />, label: "Reopen", action: reopen };

		if (review.status === "open") {
			let label = "Open";
			if (review.allReviewersMustApprove && review.reviewers && review.reviewers.length > 1) {
				const approvals = Object.keys(review.approvedBy || {}).length;
				label += ` (${approvals}/${review.reviewers.length})`;
			}
			const approval = approvedBy[derivedState.currentUserId] ? unapproveItem : approveItem;
			return (
				<DropdownButton size="compact" items={[reviewItem, approval, rejectItem]}>
					{label}
				</DropdownButton>
			);
		}
		if (review.status === "approved")
			return (
				<DropdownButton size="compact" variant="secondary" items={[reopenItem]}>
					Approved
				</DropdownButton>
			);
		if (review.status === "rejected")
			return (
				<DropdownButton size="compact" variant="secondary" items={[reopenItem]}>
					Rejected
				</DropdownButton>
			);
		return null;
	})();

	return (
		<Header>
			<Icon name="review" className="type" />
			<BigTitle>
				<HeaderActions>
					{props.children || (
						<>
							{renderedHeaderActions}
							<BaseReviewMenu review={review} setIsEditing={props.setIsEditing} />
						</>
					)}
				</HeaderActions>
				<MarkdownText text={review.title} />
			</BigTitle>
		</Header>
	);
};

export const BaseReviewMenu = (props: BaseReviewMenuProps) => {
	const { review, globalNav } = props;

	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		return {
			currentUser: state.users[state.session.userId!],
			author: state.users[props.review.creatorId],
			userIsFollowing: (props.review.followerIds || []).includes(state.session.userId!)
		};
	}, shallowEqual);
	const [shareModalOpen, setShareModalOpen] = React.useState(false);
	const [menuState, setMenuState] = React.useState<{ open: boolean; target?: any }>({
		open: false,
		target: undefined
	});

	const permalinkRef = React.useRef<HTMLTextAreaElement>(null);

	const menuItems = React.useMemo(() => {
		const items: any[] = [
			{
				label: "Share",
				key: "share",
				action: () => setShareModalOpen(true)
			},
			{
				label: "Copy link",
				key: "copy-permalink",
				action: () => {
					if (permalinkRef && permalinkRef.current) {
						permalinkRef.current.select();
						document.execCommand("copy");
					}
				}
			},
			{
				label: derivedState.userIsFollowing ? "Unfollow" : "Follow",
				key: "toggle-follow",
				action: () => {
					const value = !derivedState.userIsFollowing;
					const changeType = value ? "Followed" : "Unfollowed";
					HostApi.instance.send(FollowReviewRequestType, {
						id: review.id,
						value
					});
					HostApi.instance.track("Notification Change", {
						Change: `Review ${changeType}`,
						"Source of Change": "Review menu"
					});
				}
			}
		];

		if (review.creatorId === derivedState.currentUser.id && props.setIsEditing) {
			items.push(
				{
					label: "Edit",
					key: "edit",
					action: () => props.setIsEditing && props.setIsEditing(true)
				},
				{
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
				}
			);
		}

		return items;
	}, [review]);

	if (shareModalOpen)
		return <SharingModal review={props.review!} onClose={() => setShareModalOpen(false)} />;

	return (
		<>
			<KebabIcon
				onClickCapture={e => {
					e.preventDefault();
					e.stopPropagation();
					if (menuState.open) {
						setMenuState({ open: false });
					} else {
						setMenuState({
							open: true,
							target: globalNav ? e.currentTarget.closest("button") : e.currentTarget
						});
					}
				}}
			>
				{globalNav && <Icon name="kebab-horizontal" />}
				{!globalNav && <Icon name="kebab-vertical" className="clickable" />}
			</KebabIcon>
			<textarea
				key="permalink-offscreen"
				ref={permalinkRef}
				value={review.permalink}
				style={{ position: "absolute", left: "-9999px" }}
			/>
			{menuState.open && (
				<Menu
					target={menuState.target}
					action={() => setMenuState({ open: false })}
					items={menuItems}
				/>
			)}
		</>
	);
};

const BaseReview = (props: BaseReviewProps) => {
	const { review } = props;

	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		return {
			isInVscode: state.ide.name === "VSC",
			author: state.users[props.review.creatorId]
		};
	}, shallowEqual);
	const hasTags = props.tags && props.tags.length > 0;
	const hasReviewers = props.reviewers != null && props.reviewers.length > 0;
	const approvalLabel =
		props.reviewers != null && props.reviewers.length > 1
			? review.allReviewersMustApprove
				? " - Everyone Must Approve"
				: " - Anyone Can Approve"
			: "";
	const { approvedBy = {} } = review;
	const hasChangeRequests = props.changeRequests != null && props.changeRequests.length > 0;
	const numFiles = review.reviewChangesets
		.map(r => r.modifiedFiles.length)
		.reduce((a, b) => a + b, 0);
	const renderedFooter = props.renderFooter && props.renderFooter(CardFooter, ComposeWrapper);

	const prevFile = () => HostApi.instance.send(ShowPreviousChangedFileRequestType, {});

	const nextFile = () => HostApi.instance.send(ShowNextChangedFileRequestType, {});

	const isMacintosh = navigator.appVersion.includes("Macintosh");
	const nextFileKeyboardShortcut = () => (isMacintosh ? `⌥ F6` : "Alt-F6");
	const previousFileKeyboardShortcut = () => (isMacintosh ? `⇧ ⌥ F6` : "Shift-Alt-F6");

	return (
		<MinimumWidthCard {...getCardProps(props)} noCard={!props.collapsed}>
			<CardBody>
				{props.collapsed && (
					<BaseReviewHeader
						review={review}
						collapsed={props.collapsed}
						setIsEditing={props.setIsEditing}
					/>
				)}
				{!props.collapsed && (
					<ExpandedAuthor>
						Opened
						<Timestamp relative time={props.review.createdAt} /> by{" "}
						<HeadshotName person={derivedState.author} highlightMe />
					</ExpandedAuthor>
				)}

				{props.headerError && (
					<div
						className="color-warning"
						style={{ display: "flex", padding: "10px 0", whiteSpace: "normal" }}
					>
						<Icon name="alert" />
						<div style={{ paddingLeft: "10px" }}>{props.headerError}</div>
					</div>
				)}

				<MetaSection>
					{props.review.text && (
						<Meta>
							<MetaLabel>Description</MetaLabel>
							<MarkdownText text={props.review.text} />
						</Meta>
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
									<MetaLabel>Reviewers{approvalLabel}</MetaLabel>
									<MetaDescriptionForTags>
										{props.reviewers!.map(reviewer => {
											const addThumbsUp = approvedBy[reviewer.id] ? true : false;
											return (
												<HeadshotName person={reviewer} highlightMe addThumbsUp={addThumbsUp} />
											);
										})}
									</MetaDescriptionForTags>
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
										<MetaCheckboxWithHoverIcon key={codemark.id}>
											<Checkbox
												noMargin
												name={codemark.id}
												checked={codemark.status === CodemarkStatus.Closed}
												onChange={value => {
													dispatch(setCodemarkStatus(codemark.id, value ? "closed" : "open"));
												}}
											>
												<MarkdownText text={formattedText} />
											</Checkbox>
											<Icon
												title="Show request details"
												placement="bottom"
												delay={1}
												name="link-external"
												className="clickable"
												onClick={() => {
													// dispatch(setCurrentReview());
													dispatch(setCurrentCodemark(codemark.id));
												}}
											/>
										</MetaCheckboxWithHoverIcon>
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
												<span>
													<Icon name="repo" />
													{r.repoName}
												</span>
												<span>
													<Icon name="git-branch" />
													{r.branch}
												</span>
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
								<MetaLabel>
									Changed Files
									{props.canStartReview && numFiles > 1 && (
										<MetaIcons>
											<Icon
												onClick={nextFile}
												name="arrow-down"
												className="clickable"
												placement="top"
												delay={1}
												title={
													derivedState.isInVscode && (
														<span>
															Next File{" "}
															<span className="keybinding">{nextFileKeyboardShortcut()}</span>
														</span>
													)
												}
											/>
											<Icon
												onClick={prevFile}
												name="arrow-up"
												className="clickable"
												placement="top"
												delay={1}
												title={
													derivedState.isInVscode && (
														<span>
															Previous File{" "}
															<span className="keybinding">{previousFileKeyboardShortcut()}</span>
														</span>
													)
												}
											/>
										</MetaIcons>
									)}
								</MetaLabel>
								<MetaDescriptionForAssignees>
									<ChangesetFileList
										review={review}
										loading={props.headerError ? false : !props.canStartReview}
										noOnClick={!props.canStartReview}
									/>
								</MetaDescriptionForAssignees>
							</Meta>
						</TourTip>
					)}
					{!props.collapsed && (
						<Meta>
							<MetaLabel>Commits</MetaLabel>
							<MetaDescriptionForAssignees>
								<CommitList review={review} />
							</MetaDescriptionForAssignees>
						</Meta>
					)}
				</MetaSection>
				{props.collapsed && renderMetaSectionCollapsed(props)}
			</CardBody>
			{renderedFooter}
		</MinimumWidthCard>
	);
};

const renderMetaSectionCollapsed = (props: BaseReviewProps) => {
	const { approvedBy = {} } = props.review;
	console.warn(props.isFollowing, props.tags, props.reviewers, props.review.numReplies);
	if (!props.isFollowing && !props.tags && !props.reviewers && props.review.numReplies == 0)
		return null;
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
					props.reviewers.map(reviewer => {
						// this should never happen, but yet sometimes it does
						if (!reviewer) return null;
						const addThumbsUp = approvedBy[reviewer.id] ? true : false;
						return (
							<Tooltip
								key={reviewer.id}
								title={`${reviewer.username} ${
									addThumbsUp ? "approved this review" : "is a reviewer"
								}`}
								placement="bottom"
								align={{ offset: [0, 4] }}
							>
								<span>
									<Headshot person={reviewer} size={18} addThumbsUp={addThumbsUp} />
								</span>
							</Tooltip>
						);
					})}
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

const ReplyInput = (props: { reviewId: string; parentPostId: string; streamId: string }) => {
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
					tags: [],
					isPseudoCodemark: true
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
	};

	return (
		<>
			<MessageInput
				multiCompose
				text={text}
				placeholder="Add Comment..."
				onChange={setText}
				onSubmit={submit}
			/>
			<div style={{ display: "flex" }}>
				<div style={{ opacity: 0.7, paddingTop: "10px" }}>
					<Checkbox name="change-request" checked={isChangeRequest} onChange={setIsChangeRequest}>
						Change Request (require for approval)
					</Checkbox>
				</div>
				<div style={{ textAlign: "right", flexGrow: 1 }}>
					<Tooltip
						title={
							<span>
								Submit Comment
								<span className="keybinding extra-pad">
									{navigator.appVersion.includes("Macintosh") ? "⌘" : "Alt"} ENTER
								</span>
							</span>
						}
						placement="bottomRight"
						delay={1}
					>
						<Button
							style={{
								// fixed width to handle the isLoading case
								width: "100px",
								margin: "10px 0",
								float: "right"
							}}
							className={cx("control-button", { cancel: text.length === 0 })}
							type="submit"
							disabled={text.length === 0}
							onClick={submit}
							loading={isLoading}
						>
							{isChangeRequest ? "Request Change" : "Add Comment"}
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
	const [isEditing, setIsEditing] = React.useState(false);
	const [shareModalOpen, setShareModalOpen] = React.useState(false);

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

	const webviewFocused = useSelector((state: CodeStreamState) => state.context.hasFocus);
	useDidMount(() => {
		if (!props.collapsed && webviewFocused) {
			HostApi.instance.track("Page Viewed", { "Page Name": "Review Details" });
		}
	});

	React.useEffect(() => {
		// don't check preconditions if we're looking at the collapsed version of the
		// review (in the feed), but rather only when expanded (details view)
		if (props.collapsed) return;

		const checkPreconditions = async () => {
			let response = await HostApi.instance.send(CheckReviewPreconditionsRequestType, {
				reviewId: review.id
			});
			if (!response.success && response.error) {
				setPreconditionError(response.error);
				setCanStartReview(false);
			} else {
				// need to clear the precondition error
				setPreconditionError("");
				setCanStartReview(true);
			}
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
							<ReplyInput
								reviewId={review.id}
								parentPostId={review.postId}
								streamId={review.streamId}
							/>
						</InputContainer>
					)}
				</Footer>
			);
		});

	if (shareModalOpen)
		return <SharingModal review={props.review!} onClose={() => setShareModalOpen(false)} />;
	if (isEditing) {
		return (
			<ReviewForm
				isEditing={isEditing}
				onClose={() => {
					setIsEditing(false);
				}}
				editingReview={props.review}
			/>
		);
	} else {
		return (
			<BaseReview
				{...baseProps}
				review={props.review}
				repoInfo={repoInfo}
				tags={tags}
				changeRequests={changeRequests}
				isFollowing={derivedState.userIsFollowing}
				reviewers={derivedState.reviewers}
				currentUserId={derivedState.currentUser.id}
				renderFooter={renderFooter}
				setIsEditing={setIsEditing}
				headerError={preconditionError}
				canStartReview={canStartReview}
			/>
		);
	}
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
