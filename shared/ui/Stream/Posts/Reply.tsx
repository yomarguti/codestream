import styled from "styled-components";
import cx from "classnames";
import { CSUser } from "@codestream/protocols/api";
import { PostPlus } from "@codestream/protocols/agent";
import React from "react";
import { Headshot } from "@codestream/webview/src/components/Headshot";
import { KebabIcon } from "../Codemark/BaseCodemark";
import Icon from "../Icon";
import Timestamp from "../Timestamp";
import { getCodemark } from "@codestream/webview/store/codemarks/reducer";
import { CodeStreamState } from "@codestream/webview/store";
import { useSelector, useDispatch } from "react-redux";
import { Post, isPending } from "@codestream/webview/store/posts/types";
import Menu from "../Menu";
import { confirmPopup } from "../Confirm";
import { deletePost, editPost } from "../actions";
import { RepliesToPostContext } from "./RepliesToPost";
import { getPost } from "@codestream/webview/store/posts/reducer";
import { MarkdownText } from "../MarkdownText";
import MarkerActions from "../MarkerActions";
import MessageInput from "../MessageInput";
import Button from "../Button";
import { Dispatch } from "@codestream/webview/store/common";
import { replaceHtml } from "@codestream/webview/utils";
import { findMentionedUserIds, getTeamMembers } from "@codestream/webview/store/users/reducer";
import { editCodemark } from "@codestream/webview/store/codemarks/actions";

export interface ReplyProps {
	author: Partial<CSUser>;
	post: Post;
	nestedReplies?: PostPlus[];
	renderMenu?: (target: any, onClose: () => void) => React.ReactNode;
	className?: string;
	showParentPreview?: boolean;
	isEditing?: boolean;
}

const AuthorInfo = styled.div`
	display: flex;
	align-items: center;
	${Headshot} {
		margin-right: 7px;
	}
	.emote {
		font-weight: normal;
		padding-left: 4px;
	}
`;

const Root = styled.div`
	padding-bottom: 10px;
	padding-top: 10px;
	display: flex;
	flex-direction: column;
	// not sure if there is a better way to deal with this,
	// but if the headshot is taller than the copy (i.e. in
	// a zero-height post such as an emote) we end up with
	// too little padding between the reply and the one below
	// since the other reply has a 5px extra padding from that body
	min-height: 35px;
	${AuthorInfo} {
		font-weight: 700;
	}

	${KebabIcon} {
		visibility: hidden;
	}
`;

const ReplyBody = styled.span`
	display: flex;
	flex-direction: column;

	:hover ${KebabIcon} {
		visibility: visible;
	}
`;

const ParentPreview = styled.span`
	margin-left: 23px;
`;

const ReplyText = styled(MarkdownText)`
	margin-left: 23px;
`;

const ReviewMarkerActionsWrapper = styled.div`
	margin-left: 13px;
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

	.internal-link {
		text-decoration: none;
	}
`;

const ComposeWrapper = styled.div.attrs(() => ({
	className: "compose codemark-compose"
}))`
	&&& {
		padding: 0 !important;
	}
`;

export const Reply = (props: ReplyProps) => {
	const dispatch = useDispatch<Dispatch>();
	const { setEditingPostId } = React.useContext(RepliesToPostContext);
	const [menuState, setMenuState] = React.useState<{
		open: boolean;
		target?: any;
	}>({ open: false, target: undefined });

	const [newReplyText, setNewReplyText] = React.useState("");
	const [isLoading, setIsLoading] = React.useState(false);
	const teamMembers = useSelector((state: CodeStreamState) => getTeamMembers(state));

	const submit = async () => {
		// don't create empty replies
		if (newReplyText.length === 0) return;

		const { post } = props;
		setIsLoading(true);

		if (codemark) {
			await dispatch(editCodemark(codemark.id, { text: replaceHtml(newReplyText)! }));
		} else {
			await dispatch(
				editPost(
					post.streamId,
					post.id,
					replaceHtml(newReplyText)!,
					findMentionedUserIds(teamMembers, newReplyText)
				)
			);
		}
		setIsLoading(false);
		setNewReplyText("");
		setEditingPostId("");
	};

	const codemark = useSelector((state: CodeStreamState) =>
		isPending(props.post) ? null : getCodemark(state.codemarks, props.post.codemarkId)
	);

	const parentPost = useSelector((state: CodeStreamState) => {
		return getPost(state.posts, props.post.streamId, props.post.parentPostId!);
	});

	const isNestedReply = props.showParentPreview && parentPost.parentPostId != null;

	const postText = codemark != null ? codemark.text : props.post.text;

	const renderedMenu =
		props.renderMenu &&
		menuState.open &&
		props.renderMenu(menuState.target, () => setMenuState({ open: false }));

	const renderEmote = () => {
		let matches = (props.post.text || "").match(/^\/me\s+(.*)/);
		if (matches) return <span className="emote">{matches[1]}</span>;
		else return null;
	};
	const emote = renderEmote();

	const markers = (() => {
		if (codemark == null || codemark.markers == null || codemark.markers.length === 0) return;

		const numMarkers = codemark.markers.length;
		// not allowing any of the capabilities (they default to off anyway)
		const capabilities: any = {};
		return codemark.markers.map((marker, index) => (
			<ReviewMarkerActionsWrapper>
				<MarkerActions
					key={marker.id}
					codemark={codemark}
					marker={marker}
					capabilities={capabilities}
					isAuthor={false}
					alwaysRenderCode={true}
					markerIndex={index}
					numMarkers={numMarkers}
					jumpToMarker={false}
					selected={true}
					disableDiffCheck={true}
				/>
			</ReviewMarkerActionsWrapper>
		));
	})();

	return (
		<Root className={props.className}>
			<ReplyBody>
				<AuthorInfo style={{ fontWeight: 700 }}>
					<Headshot person={props.author} /> {props.author.username}
					{emote}
					{codemark && codemark.isChangeRequest && (
						<span className="emote">requested a change</span>
					)}
					<Timestamp relative time={props.post.createdAt} />
					<div style={{ marginLeft: "auto" }}>
						{renderedMenu}
						{props.renderMenu && (
							<KebabIcon
								onClick={e => {
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
				</AuthorInfo>
				{isNestedReply && (
					<ParentPreview>
						Reply to <a>{parentPost.text.substring(0, 80)}</a>
					</ParentPreview>
				)}
				{props.isEditing && (
					<>
						<ComposeWrapper>
							<MessageInput
								text={postText}
								onChange={setNewReplyText}
								onSubmit={submit}
								multiCompose
								autoFocus
							/>
						</ComposeWrapper>
						<div style={{ display: "flex", justifyContent: "flex-end" }}>
							<Button
								className="control-button cancel"
								style={{
									// fixed width to handle the isLoading case
									width: "80px",
									margin: "10px 10px"
								}}
								onClick={() => {
									setEditingPostId("");
									setNewReplyText("");
								}}
							>
								Cancel
							</Button>
							<Button
								style={{
									// fixed width to handle the isLoading case
									width: "80px",
									margin: "10px 0"
								}}
								className={cx("control-button", { cancel: newReplyText.length === 0 })}
								type="submit"
								disabled={newReplyText.length === 0}
								onClick={submit}
								loading={isLoading}
							>
								Submit
							</Button>
						</div>
					</>
				)}
				{emote || props.isEditing ? null : (
					<>
						<ReplyText text={postText} />
						{markers}
					</>
				)}
			</ReplyBody>
			{props.nestedReplies &&
				props.nestedReplies.length > 0 &&
				props.nestedReplies.map(r => <NestedReply key={r.id} post={r} threadId={props.post.id} />)}
		</Root>
	);
};

const NestedReply = (props: { post: Post; threadId: string }) => {
	const dispatch = useDispatch();
	const { setReplyingToPostId } = React.useContext(RepliesToPostContext);
	const author = useSelector((state: CodeStreamState) => state.users[props.post.creatorId]);
	const currentUserId = useSelector((state: CodeStreamState) => state.session.userId);

	const editReply = () => {};

	const menuItems = React.useMemo(() => {
		const menuItems: any[] = [];

		menuItems.push({
			label: "Reply",
			key: "reply",
			action: () => setReplyingToPostId(props.threadId)
		});

		if (props.post.creatorId === currentUserId) {
			// menuItems.push({ label: "Edit", key: "edit", action: editReply });
			menuItems.push({
				label: "Delete",
				key: "delete",
				action: () => {
					confirmPopup({
						title: "Are you sure?",
						message: "Deleting a post cannot be undone.",
						centered: true,
						buttons: [
							{ label: "Go Back", className: "control-button" },
							{
								label: "Delete Post",
								className: "delete",
								wait: true,
								action: () => {
									dispatch(deletePost(props.post.streamId, props.post.id));
								}
							}
						]
					});
				}
			});
		}

		return menuItems;
	}, [props.post]);

	return (
		<NestedReplyRoot
			author={author}
			post={props.post}
			renderMenu={(target, close) => <Menu target={target} action={close} items={menuItems} />}
		/>
	);
};

const NestedReplyRoot = styled(Reply)`
	padding-top: 10px;
	padding-left: 25px;
	padding-bottom: 0;
`;
