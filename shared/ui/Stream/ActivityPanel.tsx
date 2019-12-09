import React from "react";
import { useDispatch, useSelector } from "react-redux";
import Icon from "./Icon";
import ScrollBox from "./ScrollBox";
import Headshot from "./Headshot";
import { Headshot as HeadshotV2 } from "../src/components/Headshot";
import Filter from "./Filter";
import Timestamp from "./Timestamp";
import * as codemarkSelectors from "../store/codemarks/reducer";
import * as userSelectors from "../store/users/reducer";
import styled from "styled-components";
import { includes as _includes, sortBy as _sortBy, last as _last } from "lodash-es";
import { CodeStreamState } from "../store";
import { setCodemarkTypeFilter, setCurrentCodemark } from "../store/context/actions";
import { getActivity } from "../store/activityFeed/reducer";
import { useDidMount, useIntersectionObserver } from "../utilities/hooks";
import { HostApi } from "../webview-api";
import {
	FetchActivityRequestType,
	PostPlus,
	CodemarkPlus,
	FollowCodemarkRequestType,
	SetCodemarkPinnedRequestType,
	PinReplyToCodemarkRequestType
} from "@codestream/protocols/agent";
import { savePosts } from "../store/posts/actions";
import { addOlderActivity } from "../store/activityFeed/actions";
import { saveCodemarks } from "../store/codemarks/actions";
import { safe } from "../utils";
import { markStreamRead } from "./actions";
import { CodemarkType, CSUser } from "@codestream/protocols/api";
import { Card, CardBody, CardFooter, CardBanner } from "../src/components/Card";
import { resetLastReads } from "../store/unreads/actions";
import { PanelHeader } from "../src/components/PanelHeader";
import { markdownify } from "./Markdowner";
import { Marker } from "./Marker";
import { getPost, getPostsForStream } from "../store/posts/reducer";
import Tag from "./Tag";
import { PROVIDER_MAPPINGS } from "./CrossPostIssueControls/types";
import { Link } from "./Link";
import { RelatedCodemark } from "./RelatedCodemark";
import Menu from "./Menu";
import { FormattedPlural } from "react-intl";
import { SharingModal } from "./SharingModal";

// see comment in SmartFormattedList.tsx
const FormattedPluralAlias = FormattedPlural as any;

const ActivityWrapper = styled.div`
	margin: 0 40px 20px 45px;
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

const ActivityCard = styled(Card)<{ unread?: boolean }>`
	:hover {
		cursor: pointer;
	}
	${CardFooter} {
		border-top: none;
		padding-left: 0;
		padding-right: 0;
		margin-top: 0;
	}
	${props => (props.unread ? `border-left: 2px solid var(--text-color-info);` : "")}
`;

const LoadingMessage = styled.div`
	width: 100%;
	margin: 0 auto;
	text-align: center;
`;

const CardHeader = styled.div`
	width: 100%;
	margin-bottom: 8px;
	display: flex;
	font-size: 13px;
	font-weight: 700;
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

const CardTitle = styled.div`
	margin-bottom: 10px;
`;

const LinkifiedText = styled.span`
	white-space: normal;
	text-overflow: initial;
	p {
		margin: 0;
	}
`;

const MetaRow = styled.div`
	display: flex;
	justify-content: space-between;
`;

const Meta = styled.div`
	display: flex;
	flex-direction: column;
	margin-right: auto;
	width: 100%;
`;

const MetaStuff = styled.div`
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	${Meta} {
		padding: 10px 0;
	}
`;

const RelatedLabel = styled.div`
	text-transform: uppercase;
	font-weight: 800;
	opacity: 0.5;
	font-size: 11px;
	margin-bottom: 3px;
`;

const Description = styled.div`
	display: flex;
	> *:not(:first-child) {
		margin-left: 5px;
	}
`;

const StyledMarker = styled(Marker)`
	.code {
		margin: 5px 0 !important;
	}
	.file-info {
		font-size: 11px;
		display: flex;
		flex-flow: row wrap;
	}
	.file-info .monospace {
		display: block;
		white-space: nowrap;
	}
`;

const StyledLink = styled(Link)`
	color: var(--text-color);
	text-decoration: none !important;
	&:hover {
		color: var(--text-color-info);
	}
	${Description} {
		display: block;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
`;

const StyledRelatedCodemark = styled(RelatedCodemark)`
	white-space: normal;
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
			before: safe(() => _last(derivedState.activity)!.id)
		});
		dispatch(savePosts(response.posts));
		dispatch(saveCodemarks(response.codemarks));
		dispatch(
			addOlderActivity("codemark", {
				activities: response.codemarks,
				hasMore: Boolean(response.more)
			})
		);
	}, [derivedState.activity]);

	useDidMount(() => {
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

	const intersectionCallback = () => {
		if (!derivedState.hasMoreActivity) return;
		fetchActivity();
	};

	const { targetRef, rootRef } = useIntersectionObserver(intersectionCallback);

	const renderTextLinkified = React.useCallback(
		(text: string) => {
			let html: string;
			if (text == null || text === "") {
				html = "";
			} else {
				const me = derivedState.currentUserName;
				html = markdownify(text).replace(/@(\w+)/g, (match: string, name: string) => {
					if (
						derivedState.usernames.some(
							n => name.localeCompare(n, undefined, { sensitivity: "accent" }) === 0
						)
					) {
						return `<span class="at-mention${
							me.localeCompare(name, undefined, { sensitivity: "accent" }) === 0 ? " me" : ""
						}">${match}</span>`;
					}

					return match;
				});
			}

			return html;
		},
		[derivedState.usernames]
	);

	const renderActivity = () => {
		let counter = 0;
		const demoMode = false;
		const dave = { username: "dave", fullName: "David Hersh" };
		const akon = { username: "akonwi", fullName: "Akonwi Ngoh", email: "akonwi@codestream.com" };

		return derivedState.activity.map(codemark => {
			if (codemark.deactivated) return null;
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
					<ActivityItem codemark={codemark} getLinkifiedHtml={renderTextLinkified} />
				</ActivityWrapper>
			];
		});
	};

	const showActivityLabels = {
		all: "all activity",
		[CodemarkType.Comment]: "comments",
		[CodemarkType.Issue]: "issues"
	};

	const menuItems = [
		{ label: "All Activity", action: "all" },
		{ label: "-" },
		{ label: "Code Comments", action: CodemarkType.Comment },
		{ label: "Issues", action: CodemarkType.Issue }
	];

	return (
		<div className="panel full-height activity-panel">
			<PanelHeader title="Activity">
				<div className="filters">
					Show{" "}
					<Filter
						onValue={value => dispatch(setCodemarkTypeFilter(value))}
						selected={derivedState.codemarkTypeFilter}
						labels={showActivityLabels}
						items={menuItems}
					/>
				</div>
			</PanelHeader>
			<ScrollBox>
				<div ref={rootRef} className="channel-list vscroll">
					{renderActivity()}
					{derivedState.hasMoreActivity && (
						<LoadingMessage ref={targetRef}>
							<Icon className="spin" name="sync" /> Loading more...
						</LoadingMessage>
					)}
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

const ActivityItem = (props: {
	codemark: CodemarkPlus;
	getLinkifiedHtml: (text: string) => string;
}) => {
	const { codemark } = props;
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const codemarkPost = getPost(state.posts, codemark.streamId, codemark.postId);
		const lastReadForStream = state.umis.lastReads[codemark.streamId];
		const isUnread =
			lastReadForStream != undefined &&
			codemarkPost != undefined &&
			(codemarkPost as PostPlus).seqNum > lastReadForStream;
		const assignees = (codemark.assignees || []).map(id => state.users[id]).filter(Boolean);
		const externalAssignees = (codemark.externalAssignees || [])
			.filter(user => !assignees.find(a => a.email === user.email))
			.filter(Boolean)
			.map(a => ({ fullName: a.displayName, email: a.email }));

		return {
			isUnread,
			followingEnabled: state.apiVersioning.apiCapabilities.follow != undefined,
			userIsFollowingCodemark: (codemark.followerIds || []).includes(
				state.users[state.session.userId!].id
			),
			post: codemarkPost,
			author: state.users[codemark.creatorId],
			teamTags: userSelectors.getTeamTagsHash(state),
			assignees: [...assignees, ...externalAssignees]
		};
	});
	const [menuState, setMenuState] = React.useState<{
		open: boolean;
		target?: any;
	}>({ open: false, target: undefined });

	const [shareModalOpen, setShareModalOpen] = React.useState(false);
	const closeShareModal = React.useCallback(() => setShareModalOpen(false), []);

	const permalinkRef = React.useRef<HTMLTextAreaElement>(null);

	const tagIds = codemark.tags || [];
	const descriptionHTML =
		codemark.title && codemark.text ? props.getLinkifiedHtml(codemark.text) : null;
	const providerDisplay =
		codemark.externalProviderUrl && PROVIDER_MAPPINGS[codemark.externalProvider!];
	const relatedCodemarkIds = codemark.relatedCodemarkIds || [];

	const menuItems: any[] = React.useMemo(() => {
		let items: any[] = [
			{
				label: "Share",
				key: "share",
				action: () => {
					setShareModalOpen(true);
				}
			},
			{
				label: "Copy link",
				key: "copy-permalink",
				action: () => {
					if (permalinkRef.current) {
						permalinkRef.current.select();
						document.execCommand("copy");
					}
				}
			},
			{
				label: codemark.pinned ? "Archive" : "Unarchive",
				key: "toggle-pinned",
				action: () => {
					HostApi.instance.send(SetCodemarkPinnedRequestType, {
						codemarkId: codemark.id,
						value: !props.codemark.pinned
					});
				}
			}
		];
		if (derivedState.followingEnabled) {
			const [first, ...rest] = items;
			items = [
				first,
				{
					label: derivedState.userIsFollowingCodemark ? "Unfollow" : "Follow",
					key: "toggle-follow",
					action: () => {
						const value = !derivedState.userIsFollowingCodemark;
						const changeType = value ? "Followed" : "Unfollowed";
						HostApi.instance.send(FollowCodemarkRequestType, {
							codemarkId: codemark.id,
							value
						});
						HostApi.instance.track("Notification Change", {
							Change: `Codemark ${changeType}`,
							"Source of Change": "Activity Feed"
						});
					}
				},
				...rest
			];
		}

		return items;
	}, [props.codemark]);

	const closeMenu = React.useCallback(() => setMenuState({ open: false }), []);
	const handleMenuClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (menuState.open) {
			closeMenu();
		} else {
			setMenuState({ open: true, target: e.currentTarget as HTMLElement });
		}
	};

	return (
		<>
			{shareModalOpen && <SharingModal codemark={codemark} onClose={closeShareModal} />}
			<ActivityCard
				hoverEffect
				onClick={() => {
					// somehow a click right next to the menu over the kebab icon registers
					if (menuState.open) {
						return setMenuState({ open: false });
					}
					dispatch(setCurrentCodemark(codemark.id));
				}}
				unread={derivedState.isUnread}
			>
				<CardBanner>
					{!codemark.pinned && <div>This codemark is archived.</div>}
					{codemark.status == "closed" && <div>This codemark is resolved.</div>}
				</CardBanner>
				<CardBody>
					<CardHeader>
						<AuthorInfo>
							<HeadshotV2 person={derivedState.author} /> {derivedState.author.username}{" "}
							<StyledTimestamp time={codemark.createdAt} />
						</AuthorInfo>
						<div style={{ marginLeft: "auto" }}>
							{menuState.open && (
								<>
									<Menu items={menuItems} target={menuState.target} action={closeMenu} />
									<textarea
										ref={permalinkRef}
										value={codemark.permalink}
										style={{ position: "absolute", left: "-9999px" }}
									/>
								</>
							)}
							<KebabIcon onClickCapture={handleMenuClick}>
								<Icon name="kebab-vertical" className="clickable" />
							</KebabIcon>
						</div>
					</CardHeader>
					<CardTitle>
						<LinkifiedText
							dangerouslySetInnerHTML={{
								__html: props.getLinkifiedHtml(codemark.title || codemark.text)
							}}
						/>
					</CardTitle>
					<MetaStuff>
						<MetaRow>
							{tagIds.length > 0 && (
								<Meta>
									<RelatedLabel>Tags</RelatedLabel>
									<Description>
										{tagIds.map(tagId => {
											const tag = derivedState.teamTags[tagId];
											return tag ? <Tag tag={tag} key={tagId} /> : null;
										})}
									</Description>
								</Meta>
							)}
							{derivedState.assignees.length > 0 && (
								<Meta>
									<RelatedLabel>Assignees</RelatedLabel>
									<Description>
										{derivedState.assignees.map(assignee => (
											<>
												<HeadshotV2 person={assignee as any} size={18} />
												<span style={{ marginLeft: "5px" }}>
													{assignee.fullName || assignee.email}
												</span>
											</>
										))}
									</Description>
								</Meta>
							)}
						</MetaRow>
						{descriptionHTML && (
							<Meta>
								<RelatedLabel>Description</RelatedLabel>
								<Description>
									<Icon name="description" />
									<LinkifiedText dangerouslySetInnerHTML={{ __html: descriptionHTML }} />
								</Description>
							</Meta>
						)}
						{providerDisplay && (
							<Meta>
								<RelatedLabel>Linked Issues</RelatedLabel>
								<StyledLink href={codemark.externalProviderUrl}>
									<Description>
										{providerDisplay.icon && <Icon name={providerDisplay.icon} />}
										<span>{providerDisplay.displayName}</span>
										<span style={{ opacity: 0.5 }}>{codemark.externalProviderUrl}</span>
									</Description>
								</StyledLink>
							</Meta>
						)}
						{relatedCodemarkIds.length > 0 && (
							<Meta>
								<RelatedLabel>Related</RelatedLabel>
								{relatedCodemarkIds.map(id => (
									<StyledRelatedCodemark key={id} id={id} />
								))}
							</Meta>
						)}
						{codemark.pinnedReplies && (
							<PinnedReplies
								streamId={codemark.streamId}
								replyIds={codemark.pinnedReplies}
								renderTextLinkified={props.getLinkifiedHtml}
							/>
						)}
						{/* this is here just to get feedback... we should prolly have some sort of indicator on the codemark if you are following it */
						derivedState.userIsFollowingCodemark && (
							<Meta>
								<RelatedLabel>Notifications</RelatedLabel>
								<Description>
									<Icon name="eye" />{" "}
									<span>You are following activity on this codemark. [unfollow]</span>
								</Description>
							</Meta>
						)}
					</MetaStuff>
					{codemark.markers &&
						codemark.markers.map(marker => <StyledMarker key={marker.id} marker={marker} />)}
				</CardBody>
				<CardFooter>
					<RepliesForCodemark
						parentPost={derivedState.post}
						pinnedReplies={codemark.pinnedReplies}
					/>
				</CardFooter>
			</ActivityCard>
		</>
	);
};

const SeeReplies = styled.div`
	margin-top: 5px;
	text-align: center;
`;

const ReplyRoot = styled.div`
	padding-left: 10px;
	padding-bottom: 10px;
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

	return (
		<ReplyRoot>
			<AuthorInfo style={{ fontWeight: 700 }}>
				<HeadshotV2 person={props.author} /> {props.author.username}
				<StyledTimestamp time={props.post.createdAt} />
				<div style={{ marginLeft: "auto", marginRight: "10px" }}>
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
			<div style={{ marginLeft: "23px" }}>{props.post.text}</div>
		</ReplyRoot>
	);
};

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
					author={users[post.creatorId]}
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

const PinnedReply = styled.div`
	display: flex;
	> * {
		margin-right: 5px;
	}
`;

const PinnedReplyText = styled.div`
	opacity: 0.5;
`;

const PinnedReplies = (props: {
	replyIds: string[];
	streamId: string;
	renderTextLinkified(text: string): string;
}) => {
	const { users, posts } = useSelector((state: CodeStreamState) => {
		return {
			users: state.users,
			posts: props.replyIds.map(id => getPost(state.posts, props.streamId, id))
		};
	});

	if (posts.length === 0) return null;

	return (
		<Meta>
			<RelatedLabel>Starred Replies</RelatedLabel>
			{posts.map(post => (
				<PinnedReply key={post.id}>
					<Icon name="star" /> <HeadshotV2 person={users[post.creatorId]} />
					<PinnedReplyText
						dangerouslySetInnerHTML={{ __html: props.renderTextLinkified(post.text) }}
					/>
				</PinnedReply>
			))}
		</Meta>
	);
};
