import React from "react";
import { useDispatch, useSelector } from "react-redux";
import Icon from "./Icon";
import ScrollBox from "./ScrollBox";
import Headshot from "./Headshot";
import { Headshot as HeadshotV2 } from "../src/components/Headshot";
import Timestamp from "./Timestamp";
import * as codemarkSelectors from "../store/codemarks/reducer";
import * as userSelectors from "../store/users/reducer";
import styled from "styled-components";
import { includes as _includes, sortBy as _sortBy, last as _last } from "lodash-es";
import { CodeStreamState } from "../store";
import { setCurrentCodemark } from "../store/context/actions";
import { getActivity } from "../store/activityFeed/reducer";
import { useDidMount, useIntersectionObserver } from "../utilities/hooks";
import { HostApi } from "../webview-api";
import {
	FetchActivityRequestType,
	PostPlus,
	CodemarkPlus,
	PinReplyToCodemarkRequestType,
	ReviewPlus
} from "@codestream/protocols/agent";
import { savePosts } from "../store/posts/actions";
import { addOlderActivity } from "../store/activityFeed/actions";
import { saveCodemarks } from "../store/codemarks/actions";
import { safe } from "../utils";
import { markStreamRead, setCodemarkTypeFilter } from "./actions";
import { CSUser, CodemarkType } from "@codestream/protocols/api";
import { resetLastReads } from "../store/unreads/actions";
import { PanelHeader } from "../src/components/PanelHeader";
import { getPost, getPostsForStream } from "../store/posts/reducer";
import Menu from "./Menu";
import { FormattedPlural } from "react-intl";
import { useMarkdownifyToHtml } from "./Markdowner";
import { Codemark } from "./Codemark/index";
import Filter from "./Filter";
import { Review } from "./Review";
import { saveReviews } from "../store/reviews/actions";

// see comment in SmartFormattedList.tsx
const FormattedPluralAlias = FormattedPlural as any;

const ActivityWrapper = styled.div`
	// tag: codemark-width
	margin: 5px 40px 20px 20px;
	> time,
	> .activity {
		display: block;
		margin-bottom: 20px !important;
		text-align: center;
		.details {
		}
	}
	.emote {
		font-weight: normal;
		padding-left: 4px;
	}
	.codemark-details {
		margin-bottom: 5px;
	}
`;

const LoadingMessage = styled.div`
	width: 100%;
	margin: 0 auto;
	text-align: center;
`;

const StyledTimestamp = styled(Timestamp)`
	opacity: 0.4;
	font-size: 11px;
	padding-left: 5px;
	.details {
		padding-left: 5px;
		transition: opacity 0.4s;
	}
`;

const AuthorInfo = styled.div`
	display: flex;
	align-items: center;
	${HeadshotV2} {
		margin-right: 7px;
	}
`;

const LinkifiedText = styled.span`
	white-space: normal;
	text-overflow: initial;
	p {
		margin: 0;
	}
`;

const EmptyMessage = styled.div`
	height: 100%;
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	p {
		width: 20em;
		margin: 0 auto;
		color: var(--text-color-subtle);
		text-align: center;
	}
`;

export const ActivityPanel = () => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const usernames = userSelectors.getUsernames(state);

		return {
			usernames,
			users: state.users,
			noCodemarksAtAll: !codemarkSelectors.teamHasCodemarks(state),
			currentUserName: state.users[state.session.userId!].username,
			activity: getActivity(state),
			hasMoreActivity: state.activityFeed.hasMore,
			codemarkTypeFilter: state.context.codemarkTypeFilter,
			umis: state.umis,
			webviewFocused: state.context.hasFocus
		};
	});

	const fetchActivity = React.useCallback(async () => {
		const response = await HostApi.instance.send(FetchActivityRequestType, {
			limit: 50,
			before: safe(() => _last(derivedState.activity)!.record.postId)
		});
		dispatch(savePosts(response.posts));
		dispatch(saveCodemarks(response.codemarks));
		dispatch(saveReviews(response.reviews));
		dispatch(
			addOlderActivity({
				activities: response.records,
				hasMore: Boolean(response.more)
			})
		);
	}, [derivedState.activity]);

	useDidMount(() => {
		if (derivedState.webviewFocused)
			HostApi.instance.track("Page Viewed", { "Page Name": "Activity Feed" });

		if (derivedState.activity.length === 0) fetchActivity();
		return () => {
			dispatch(resetLastReads());
		};
	});

	React.useEffect(() => {
		for (let streamId in derivedState.umis.unreads) {
			dispatch(markStreamRead(streamId));
		}
	}, [derivedState.webviewFocused]);

	const { targetRef, rootRef } = useIntersectionObserver(entries => {
		if (!entries[0].isIntersecting) return;
		if (!derivedState.hasMoreActivity || derivedState.activity.length === 0) return;
		fetchActivity();
	});

	const renderActivity = () => {
		let counter = 0;
		const demoMode = false;
		const dave = { username: "dave", fullName: "David Hersh" };
		const akon = { username: "akonwi", fullName: "Akonwi Ngoh", email: "akonwi@codestream.com" };

		if (derivedState.activity.length === 0 && !derivedState.hasMoreActivity) {
			return (
				<EmptyMessage>
					<p>
						The activity feed will let you know when your teammates create codemarks, or add
						replies.
					</p>
				</EmptyMessage>
			);
		}

		return derivedState.activity.map(({ type, record }) => {
			if (type === "codemark") {
				const codemark = record as CodemarkPlus;
				if (
					derivedState.codemarkTypeFilter != "all" &&
					codemark.type !== derivedState.codemarkTypeFilter
				)
					return null;

				return [
					demoMode && counter == 2 ? (
						<ActivityWrapper key={counter}>
							<div className="codemark inline">
								<div className="contents">
									<div className="body">
										<div className="header" style={{ margin: 0 }}>
											<div className="author">
												<Headshot person={dave} />
												dave <span className="emote">joined CodeStream</span>
												<Timestamp time={codemark.createdAt} />
											</div>
										</div>
									</div>
								</div>
							</div>
						</ActivityWrapper>
					) : null,
					demoMode && counter == 3 ? (
						<ActivityWrapper key={counter}>
							<div className="codemark inline">
								<div className="contents">
									<div className="body">
										<div className="header">
											<div className="author">
												<Headshot person={akon} />
												akon <span className="emote"> created </span> &nbsp;{" "}
												<Icon name="git-branch" />
												<span className="monospace" style={{ paddingLeft: "5px" }}>
													feature/sharing
												</span>
												<Timestamp time={codemark.createdAt} />
											</div>
										</div>
										<div className="right" style={{ margin: "10px 0 0 0" }}>
											<div className="codemark-actions-button">Checkout</div>
											<div className="codemark-actions-button">Open on GitHub</div>
										</div>
									</div>
								</div>
							</div>
						</ActivityWrapper>
					) : null,
					<ActivityWrapper key={codemark.id}>
						{/* <Timestamp dateOnly={true} time={codemark.createdAt} /> */}
						{demoMode && counter == 5 && <Timestamp dateOnly={true} time={codemark.createdAt} />}
						<ActivityItem streamId={codemark.streamId} postId={codemark.postId}>
							{({ isUnread, post }) => (
								// @ts-ignore because typescript isn't handling the union props well
								<ActivityCodemark
									collapsed={!isUnread}
									codemark={codemark}
									hoverEffect
									isUnread={isUnread}
									onClick={() => {
										HostApi.instance.track("Codemark Clicked", {
											"Codemark ID": codemark.id,
											"Codemark Location": "Activity Feed"
										});
										dispatch(setCurrentCodemark(codemark.id));
									}}
									renderActions={false}
									renderFooter={Footer => (
										<Footer
											style={{ borderTop: "none", paddingLeft: 0, paddingRight: 0, marginTop: 0 }}
										>
											<RepliesForCodemark
												parentPost={post}
												pinnedReplies={codemark.pinnedReplies}
											/>
										</Footer>
									)}
								/>
							)}
						</ActivityItem>
					</ActivityWrapper>
				];
			}

			if (type === "review") {
				return (
					<ActivityWrapper key={record.id}>
						<ActivityItem streamId={record.streamId} postId={record.postId}>
							{() => <Review review={record as ReviewPlus} collapsed hoverEffect />}
						</ActivityItem>
					</ActivityWrapper>
				);
			}

			return null;
		});
	};

	const showActivityLabels = {
		all: "all activity",
		[CodemarkType.Comment]: "comments",
		[CodemarkType.Review]: "code reviews",
		[CodemarkType.Issue]: "issues"
	};

	const menuItems = [
		{ label: "All Activity", action: "all" },
		{ label: "-" },
		{ label: "Comments", action: CodemarkType.Comment },
		{ label: "Issues", action: CodemarkType.Issue },
		{ label: "Code Reviews", action: CodemarkType.Review }
	];

	return (
		<div className="panel full-height activity-panel">
			<PanelHeader title="Activity">
				{
					<div className="filters">
						Show{" "}
						<Filter
							type="toggle"
							onValue={value => dispatch(setCodemarkTypeFilter(value))}
							selected={derivedState.codemarkTypeFilter}
							labels={showActivityLabels}
							items={menuItems}
						/>
					</div>
				}
			</PanelHeader>
			<ScrollBox>
				<div ref={rootRef} className="channel-list vscroll">
					{renderActivity()}
					{derivedState.hasMoreActivity &&
						(derivedState.activity.length === 0 ? (
							<LoadingMessage>
								<Icon className="spin" name="sync" /> Loading latest activity...
							</LoadingMessage>
						) : (
							<LoadingMessage ref={targetRef}>
								<Icon className="spin" name="sync" /> Loading more...
							</LoadingMessage>
						))}
				</div>
			</ScrollBox>
			{/*
			<div className="view-selectors">
				<span className="count">
					Commits<div className="switch"></div>
				</span>
				<span className="count">
					Branches<div className="switch"></div>
				</span>
				<Feedback />
			</div>
			*/}
		</div>
	);
};

const ActivityCodemark = styled(Codemark)<{ isUnread?: boolean }>`
	${props =>
		props.isUnread
			? `
		border-left: 2px solid var(--text-color-info);
		${ReplyRoot} { border-left: none; }
		`
			: ""}
`;

const ActivityItem = (props: {
	postId: string;
	streamId: string;
	children: (...args: any[]) => any;
}) => {
	const { isUnread, post } = useSelector((state: CodeStreamState) => {
		const codemarkPost = getPost(state.posts, props.streamId, props.postId);
		const lastReadForStream = state.umis.lastReads[props.streamId];

		return {
			isUnread:
				lastReadForStream != undefined &&
				codemarkPost != undefined &&
				(codemarkPost as PostPlus).seqNum > lastReadForStream,
			post: codemarkPost
		};
	});

	return props.children({ isUnread, post });
};

const KebabIcon = styled.span`
	opacity: 0.5;
	width: 20px;
	display: flex;
	justify-content: flex-end;
	:hover {
		opacity: 1;
		.icon {
			color: var(--text-color-info);
		}
	}
`;

const SeeReplies = styled.div`
	text-align: center;
`;

const ReplyRoot = styled.div`
	padding: 0 10px 10px 10px;
	display: flex;
	flex-direction: column;
	border-left: 2px solid var(--text-color-info);
	${AuthorInfo} {
		font-weight: 700;
	}
`;

const Reply = (props: {
	author: Partial<CSUser>;
	post: PostPlus;
	starred: boolean;
	codemarkId: string;
}) => {
	const [menuState, setMenuState] = React.useState<{
		open: boolean;
		target?: any;
	}>({ open: false, target: undefined });

	const closeMenu = React.useCallback(() => setMenuState({ open: false }), []);

	const menuItems = React.useMemo(
		() => [
			{
				label: props.starred ? "Un-Star Reply" : "Star Reply",
				key: "star",
				action: () => {
					HostApi.instance.send(PinReplyToCodemarkRequestType, {
						codemarkId: props.codemarkId,
						postId: props.post.id,
						value: !props.starred
					});
				}
			}
		],
		[props.starred]
	);

	const markdownifyToHtml = useMarkdownifyToHtml();

	return (
		<ReplyRoot>
			<AuthorInfo style={{ fontWeight: 700 }}>
				<HeadshotV2 person={props.author} /> {props.author.username}
				<StyledTimestamp time={props.post.createdAt} />
				<div style={{ marginLeft: "auto" }}>
					<KebabIcon
						onClick={e => {
							e.preventDefault();
							e.stopPropagation();
							if (menuState.open) {
								closeMenu();
							} else {
								setMenuState({ open: true, target: e.currentTarget });
							}
						}}
					>
						<Icon name="kebab-vertical" />
					</KebabIcon>
					{menuState.open && (
						<Menu items={menuItems} target={menuState.target} action={closeMenu} />
					)}
				</div>
			</AuthorInfo>
			<LinkifiedText
				style={{ marginLeft: "23px" }}
				dangerouslySetInnerHTML={{ __html: markdownifyToHtml(props.post.text) }}
			/>
		</ReplyRoot>
	);
};

const createUnknownUser = id => ({ username: id, fullName: "Unknown" });

const RepliesForCodemark = (props: { parentPost?: PostPlus; pinnedReplies?: string[] }) => {
	const derivedState = useSelector((state: CodeStreamState) => {
		if (props.parentPost == undefined) return { numberOfReplies: 0, unreadReplies: [] };
		const lastUnreadForStream = state.umis.lastReads[props.parentPost.streamId] as
			| number
			| undefined;
		const unreadReplies: PostPlus[] =
			lastUnreadForStream != undefined
				? getPostsForStream(state.posts, props.parentPost.streamId)
						.filter(
							post =>
								post.parentPostId === props.parentPost!.id && post.seqNum > lastUnreadForStream
						)
						.reverse()
				: [];

		return { numberOfReplies: props.parentPost.numReplies, unreadReplies };
	});

	const users = useSelector((state: CodeStreamState) => state.users);

	if (derivedState.numberOfReplies === 0) return null;

	if (derivedState.unreadReplies.length === 0) return <SeeReplies>See replies</SeeReplies>;

	const otherReplyCount = derivedState.numberOfReplies - derivedState.unreadReplies.length;

	return (
		<>
			{derivedState.unreadReplies.map(post => (
				<Reply
					key={post.id}
					post={post}
					author={users[post.creatorId] || createUnknownUser(post.creatorId)}
					starred={Boolean(props.pinnedReplies && props.pinnedReplies.includes(post.id))}
					codemarkId={props.parentPost!.codemarkId!}
				/>
			))}
			{otherReplyCount > 0 && (
				<SeeReplies>
					See {otherReplyCount} earlier{" "}
					<FormattedPluralAlias value={otherReplyCount} one="reply" other="replies" />
				</SeeReplies>
			)}
		</>
	);
};
