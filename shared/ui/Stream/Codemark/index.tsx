import React from "react";
import {
	CodemarkPlus,
	SetCodemarkPinnedRequestType,
	FollowCodemarkRequestType
} from "@codestream/protocols/agent";
import styled from "styled-components";
import { useSelector, useDispatch } from "react-redux";
import { CodeStreamState } from "@codestream/webview/store";
import { getCodemark } from "@codestream/webview/store/codemarks/reducer";
import { getTeamTagsHash } from "@codestream/webview/store/users/reducer";
import { PROVIDER_MAPPINGS } from "../CrossPostIssueControls/types";
import { RelatedCodemark } from "../RelatedCodemark";
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
import { BaseCodemarkProps, BaseCodemark, Text } from "./BaseCodemark";
import { useMarkdownifyToHtml } from "../Markdowner";
import Icon from "../Icon";
import { Headshot } from "@codestream/webview/src/components/Headshot";
import { logError } from "@codestream/webview/logger";

const StyledRelatedCodemark = styled(RelatedCodemark)`
	white-space: normal;
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

const PinnedReply = styled.div`
	display: flex;
	> * {
		margin-right: 5px;
	}
`;

const PinnedReplyText = styled(Text)`
	opacity: 0.5;
`;

type FromBaseCodemarkProps = Pick<
	BaseCodemarkProps,
	| "collapsed"
	| "hoverEffect"
	| "onClick"
	| "className"
	| "renderMarkers"
	| "renderFooter"
	| "renderActions"
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
	// this is to try and figure out why and when this error might occur
	React.useEffect(() => {
		if (derivedState.author == undefined) {
			logError("<CodemarkForCodemark/> derivedState.author is undefined", {
				codemarkId: props.codemark.id,
				authorId: props.codemark.creatorId
			});
		}
	}, [derivedState.author]);
	const permalinkRef = React.useRef<HTMLTextAreaElement>(null);
	const [isEditing, setIsEditing] = React.useState(false);
	// const [injectingMarkerId, setInjectingMarkerId] = React.useState<string | undefined>();
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
		if (codemark.markers && codemark.markers.length > 1) {
			// const submenu = codemark.markers.map((m, index) => {
			// 	let label = "At Code Location #" + (index + 1);
			// 	return { label, action: () => setInjectingMarkerId(m.id), key: index };
			// });
			// items.push({ label: "Inject as Inline Comment", submenu: submenu, key: "inject" });
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
			<BaseCodemark
				{...baseProps}
				codemark={codemark}
				author={derivedState.author!}
				isFollowing={derivedState.userIsFollowingCodemark}
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
