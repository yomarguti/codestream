import React from "react";
import cx from "classnames";
import { Card, CardBanner, CardBody, CardFooter, CardProps } from "../../src/components/Card";
import {
	CodemarkPlus,
	SetCodemarkPinnedRequestType,
	FollowCodemarkRequestType
} from "@codestream/protocols/agent";
import styled from "styled-components";
import { Headshot } from "@codestream/webview/src/components/Headshot";
import { CSUser, CSMarker } from "@codestream/protocols/api";
import Timestamp from "../Timestamp";
import { useSelector, useDispatch } from "react-redux";
import { CodeStreamState } from "@codestream/webview/store";
import { getCodemark } from "@codestream/webview/store/codemarks/reducer";
import { useMarkdownifyToHtml } from "../Markdowner";
import Tag from "../Tag";
import { getTeamTagsHash } from "@codestream/webview/store/users/reducer";
import Icon from "../Icon";
import { PROVIDER_MAPPINGS } from "../CrossPostIssueControls/types";
import { Link } from "../Link";
import { RelatedCodemark } from "../RelatedCodemark";
import { Marker } from "../Marker";
import { getPost } from "@codestream/webview/store/posts/reducer";
import Menu from "../Menu";
import { HostApi } from "../..";
import { CodemarkForm } from "../CodemarkForm";
import {
	NewCodemarkAttributes,
	editCodemark,
	deleteCodemark
} from "@codestream/webview/store/codemarks/actions";
import { confirmPopup } from "../Confirm";
import { setCurrentCodemark } from "@codestream/webview/store/context/actions";
import { SharingModal } from "../SharingModal";

const Header = styled.div`
	width: 100%;
	margin-bottom: 8px;
	display: flex;
	font-size: 13px;
	font-weight: 700;
`;

const AuthorInfo = styled.div`
	display: flex;
	align-items: center;
	${Headshot} {
		margin-right: 7px;
	}
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

const Title = styled.div`
	margin-bottom: 10px;
`;

const Text = styled.span`
	white-space: normal;
	text-overflow: initial;
	p {
		margin: 0;
	}
`;

const Meta = styled.div`
	display: flex;
	flex-direction: column;
	margin-right: auto;
	width: 100%;
`;

const MetaSection = styled.div`
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	${Meta} {
		padding: 10px 0;
	}
`;

const MetaRow = styled.div`
	display: flex;
	justify-content: space-between;
`;

const MetaLabel = styled.div`
	text-transform: uppercase;
	font-weight: 800;
	opacity: 0.5;
	font-size: 11px;
	margin-bottom: 3px;
`;

const MetaDescription = styled.div`
	display: flex;
	> *:not(:first-child) {
		margin-left: 5px;
	}
`;

const LinkForExternalUrl = styled(Link)`
	color: var(--text-color);
	text-decoration: none !important;
	&:hover {
		color: var(--text-color-info);
	}
	${MetaDescription} {
		display: block;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
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
	.icon {
		vertical-align: 2px;
	}
`;

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

interface BaseCodemarkProps extends CardProps {
	codemark: CodemarkPlus;
	author: CSUser;
	tags?: { id: string }[];
	assignees?: Partial<CSUser>[];
	currentUserEmail?: string;
	providerDisplay?: typeof PROVIDER_MAPPINGS[string];
	relatedCodemarks?: any[];
	pinnedReplies?: any;
	// A menu icon is only displayed if this function returns non-nil
	renderMenu?: (target: any, onClose: () => void) => React.ReactNode;
	// A value of false will hide markers completely. The function can return it's own rendering or null
	renderMarkers?: boolean | ((markers: CSMarker[]) => React.ReactNode);
	// The <CardFooter/> is provided to allow overriding the container style and it must be the returned child
	renderFooter?: (footer: typeof CardFooter) => React.ReactNode;
}

const getCardProps = (props: BaseCodemarkProps) => ({
	onClick: props.onClick,
	hoverEffect: props.hoverEffect,
	className: props.className
});

export function CodemarkBase(props: BaseCodemarkProps) {
	const markdownifyToHtml = useMarkdownifyToHtml();
	const [menuState, setMenuState] = React.useState<{ open: boolean; target?: any }>({
		open: false,
		target: undefined
	});

	const { codemark } = props;

	const hasTags = props.tags && props.tags.length > 0;
	const hasAssignees = props.assignees && props.assignees.length > 0;
	const hasRelatedCodemarks = props.relatedCodemarks && props.relatedCodemarks.length > 0;

	const renderedMenu =
		props.renderMenu &&
		menuState.open &&
		props.renderMenu(menuState.target, () => setMenuState({ open: false }));

	const renderedMarkers = (() => {
		if (codemark.markers == undefined || props.renderMarkers === false) return null;

		if (props.renderMarkers == undefined || props.renderMarkers === true)
			return codemark.markers.map(marker => <StyledMarker key={marker.id} marker={marker} />);

		return props.renderMarkers(codemark.markers);
	})();

	const renderedFooter = props.renderFooter ? props.renderFooter(CardFooter) : null;

	return (
		<Card {...getCardProps(props)}>
			<CardBanner>
				{!codemark.pinned && <div>This codemark is archived.</div>}
				{codemark.status == "closed" && <div>This codemark is resolved.</div>}
			</CardBanner>
			<CardBody>
				<Header>
					<AuthorInfo>
						<Headshot person={props.author} /> {props.author.username}{" "}
						<StyledTimestamp time={codemark.createdAt} />
					</AuthorInfo>
					<div style={{ marginLeft: "auto" }}>
						{renderedMenu}
						{props.renderMenu && (
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
						)}
					</div>
				</Header>
				<Title>
					<Text
						dangerouslySetInnerHTML={{
							__html: markdownifyToHtml(codemark.title || codemark.text)
						}}
					/>
				</Title>
				<MetaSection>
					{(hasTags || hasAssignees) && (
						<MetaRow>
							{hasTags && (
								<Meta>
									<MetaLabel>Tags</MetaLabel>
									<MetaDescription>
										{props.tags!.map(tag => (
											<Tag tag={tag} key={tag.id} />
										))}
									</MetaDescription>
								</Meta>
							)}
							{hasAssignees && (
								<Meta>
									<MetaLabel>Assignees</MetaLabel>
									<MetaDescription>
										{props.assignees!.map(assignee => (
											<React.Fragment key={assignee.fullName || assignee.email}>
												<Headshot person={assignee as any} size={18} />
												<span
													style={{ marginLeft: "5px" }}
													className={cx({
														"at-mention me":
															assignee.email != undefined &&
															assignee.email === props.currentUserEmail
													})}
												>
													{assignee.fullName || assignee.email}
												</span>
											</React.Fragment>
										))}
									</MetaDescription>
								</Meta>
							)}
						</MetaRow>
					)}
					{codemark.title && codemark.text && (
						<Meta>
							<MetaLabel>Description</MetaLabel>
							<MetaDescription>
								<Icon name="description" />
								<Text dangerouslySetInnerHTML={{ __html: markdownifyToHtml(codemark.text) }} />
							</MetaDescription>
						</Meta>
					)}
					{props.providerDisplay && (
						<Meta>
							<MetaLabel>Linked Issues</MetaLabel>
							<LinkForExternalUrl href={codemark.externalProviderUrl}>
								<MetaDescription>
									{props.providerDisplay.icon && <Icon name={props.providerDisplay.icon} />}
									<span>{props.providerDisplay.displayName}</span>
									<span style={{ opacity: 0.5 }}>{codemark.externalProviderUrl}</span>
								</MetaDescription>
							</LinkForExternalUrl>
						</Meta>
					)}
					{hasRelatedCodemarks && (
						<Meta>
							<MetaLabel>Related</MetaLabel>
							{props.relatedCodemarks}
						</Meta>
					)}
					{props.pinnedReplies && (
						<Meta>
							<MetaLabel>Starred Replies</MetaLabel>
							{props.pinnedReplies}
						</Meta>
					)}
				</MetaSection>
				{renderedMarkers}
			</CardBody>
			{renderedFooter}
		</Card>
	);
}

const PinnedReply = styled.div`
	display: flex;
	> * {
		margin-right: 5px;
	}
`;

const PinnedReplyText = styled(Text)`
	opacity: 0.5;
`;

const PinnedReplies = (props: { replyIds: string[]; streamId: string }) => {
	const { users, posts } = useSelector((state: CodeStreamState) => {
		return {
			users: state.users,
			posts: props.replyIds.map(id => getPost(state.posts, props.streamId, id))
		};
	});

	const markdownifyToHtml = useMarkdownifyToHtml();

	if (posts.length === 0) return null;

	return (
		<>
			{posts.map(post => (
				<PinnedReply key={post.id}>
					<Icon name="star" /> <Headshot person={users[post.creatorId]} />
					<PinnedReplyText dangerouslySetInnerHTML={{ __html: markdownifyToHtml(post.text) }} />
				</PinnedReply>
			))}
		</>
	);
};

const StyledRelatedCodemark = styled(RelatedCodemark)`
	white-space: normal;
`;

type FromBaseCodemarkProps = Pick<
	BaseCodemarkProps,
	"hoverEffect" | "onClick" | "className" | "renderMarkers" | "renderFooter"
>;

interface PropsWithCodemark extends FromBaseCodemarkProps {
	codemark: CodemarkPlus;
}

function CodemarkForCodemark(props: PropsWithCodemark) {
	const { codemark, ...baseProps } = props;
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const author = state.users[codemark.creatorId];
		const teamTagsById = getTeamTagsHash(state);
		const csAssignees = (codemark.assignees || []).map(id => state.users[id]).filter(Boolean);
		const externalAssignees = (codemark.externalAssignees || [])
			.filter(user => !csAssignees.find(a => a.email === user.email))
			.filter(Boolean)
			.map(a => ({ fullName: a.displayName, email: a.email }));

		return {
			author,
			inSharingModel: state.featureFlags.sharing,
			isMine: author.id === state.session.userId!,
			tags: codemark.tags ? codemark.tags.map(id => teamTagsById[id]) : [],
			assignees: [...csAssignees, ...externalAssignees],
			currentUserEmail: state.users[state.session.userId!].email,
			followingEnabled: state.apiVersioning.apiCapabilities.follow != undefined,
			userIsFollowingCodemark: (codemark.followerIds || []).includes(
				state.users[state.session.userId!].id
			)
		};
	});
	const permalinkRef = React.useRef<HTMLTextAreaElement>(null);
	const [isEditing, setIsEditing] = React.useState(false);
	const [shareModalOpen, toggleShareModal] = React.useReducer(open => !open, false);

	const menuItems: any[] = React.useMemo(() => {
		if (codemark == undefined) return [];

		let items: any[] = [
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
						value: !codemark.pinned
					});
				}
			}
		];

		if (derivedState.isMine) {
			items.push(
				{ label: "Edit", key: "edit", action: () => setIsEditing(true) },
				{
					label: "Delete",
					key: "delete",
					action: () => {
						confirmPopup({
							title: "Are you sure?",
							message: "Deleting a codemark cannot be undone.",
							centered: true,
							buttons: [
								{
									label: "Delete Codemark",
									wait: true,
									action: () => {
										dispatch(deleteCodemark(codemark.id));
										dispatch(setCurrentCodemark());
									}
								},
								{ label: "Cancel" }
							]
						});
					}
				}
			);
		}
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
							"Source of Change": "Codemark menu"
						});
					}
				},
				...rest
			];
		}
		if (derivedState.inSharingModel) {
			items.unshift({
				label: "Share",
				key: "share",
				action: toggleShareModal
			});
		}

		return items;
	}, [codemark]);

	if (!codemark) {
		return null;
	}

	if (isEditing) {
		return (
			// this could be a <Card/> but the form padding needs to be removed
			<div className="editing-codemark-container">
				<CodemarkForm
					isEditing
					editingCodemark={codemark}
					commentType={codemark.type}
					onSubmit={async (attributes: NewCodemarkAttributes) => {
						const { text, assignees, title, relatedCodemarkIds, tags } = attributes;
						await dispatch(
							editCodemark(props.codemark.id, {
								text,
								title,
								assignees,
								relatedCodemarkIds,
								tags
							})
						);
						setIsEditing(false);
					}}
					onClickClose={() => setIsEditing(false)}
					streamId={codemark.streamId}
					collapsed={false}
				/>
			</div>
		);
	}

	return (
		<>
			{shareModalOpen && (
				<SharingModal codemark={codemark} onClose={toggleShareModal as () => void} />
			)}
			<CodemarkBase
				{...baseProps}
				codemark={codemark}
				author={derivedState.author!}
				tags={derivedState.tags}
				assignees={derivedState.assignees}
				currentUserEmail={derivedState.currentUserEmail}
				providerDisplay={PROVIDER_MAPPINGS[codemark.externalProvider!]}
				pinnedReplies={
					codemark.pinnedReplies &&
					codemark.pinnedReplies.length > 0 && (
						<PinnedReplies replyIds={codemark.pinnedReplies} streamId={codemark.streamId} />
					)
				}
				relatedCodemarks={
					codemark.relatedCodemarkIds &&
					codemark.relatedCodemarkIds.map(id => <StyledRelatedCodemark key={id} id={id} />)
				}
				renderMenu={(target, onClose) => {
					return (
						<>
							<Menu items={menuItems} target={target} action={onClose} />
							<textarea
								ref={permalinkRef}
								defaultValue={codemark.permalink}
								style={{ position: "absolute", left: "-9999px" }}
							/>
						</>
					);
				}}
			/>
		</>
	);
}

interface PropsWithId extends FromBaseCodemarkProps {
	id: string;
}

function isPropsWithId(props: PropsWithId | PropsWithCodemark): props is PropsWithId {
	return (props as any).id != undefined;
}

export function CodemarkForId(props: PropsWithId) {
	const { id, ...otherProps } = props;

	const codemark = useSelector((state: CodeStreamState) => getCodemark(state.codemarks, id));
	if (codemark == undefined) return null;

	return <CodemarkForCodemark codemark={codemark} {...otherProps} />;
}

export const Codemark = (props: PropsWithId | PropsWithCodemark) => {
	if (isPropsWithId(props)) {
		return <CodemarkForId {...props} />;
	} else return <CodemarkForCodemark {...props} />;
};
