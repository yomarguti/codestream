import styled from "styled-components";
import { CSUser } from "@codestream/protocols/api";
import { PostPlus } from "@codestream/protocols/agent";
import React from "react";
import { useMarkdownifyToHtml } from "../Markdowner";
import { Headshot } from "@codestream/webview/src/components/Headshot";
import { StyledTimestamp, MarkdownText, KebabIcon, StyledMarker } from "../Codemark/BaseCodemark";
import Icon from "../Icon";
import { getCodemark } from "@codestream/webview/store/codemarks/reducer";
import { CodeStreamState } from "@codestream/webview/store";
import { useSelector, useDispatch } from "react-redux";
import { Post, isPending } from "@codestream/webview/store/posts/types";
import Menu from "../Menu";
import { confirmPopup } from "../Confirm";
import { deletePost } from "../actions";
import { RepliesToPostContext } from "./RepliesToPost";
import { getPost } from "@codestream/webview/store/posts/reducer";

export interface ReplyProps {
	author: Partial<CSUser>;
	post: Post;
	nestedReplies?: PostPlus[];
	renderMenu?: (target: any, onClose: () => void) => React.ReactNode;
	className?: string;
	showParentPreview?: boolean;
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

	${StyledMarker} {
		margin-left: 25px;
		.internal-link {
			text-decoration: none;
		}
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

export const Reply = (props: ReplyProps) => {
	const [menuState, setMenuState] = React.useState<{
		open: boolean;
		target?: any;
	}>({ open: false, target: undefined });

	const codemark = useSelector((state: CodeStreamState) =>
		isPending(props.post) ? null : getCodemark(state.codemarks, props.post.codemarkId)
	);

	const parentPost = useSelector((state: CodeStreamState) => {
		return getPost(state.posts, props.post.streamId, props.post.parentPostId!);
	});

	const isNestedReply = props.showParentPreview && parentPost.parentPostId != null;

	const postText = codemark != null ? codemark.text : props.post.text;

	const markdownifyToHtml = useMarkdownifyToHtml();

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

		return codemark.markers.map(marker => <StyledMarker key={marker.id} marker={marker} />);
	})();

	return (
		<Root className={props.className}>
			<ReplyBody>
				<AuthorInfo style={{ fontWeight: 700 }}>
					<Headshot person={props.author} /> {props.author.username}
					{emote}
					<StyledTimestamp time={props.post.createdAt} />
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
				{emote ? null : (
					<>
						<MarkdownText
							style={{ marginLeft: "23px" }}
							dangerouslySetInnerHTML={{ __html: markdownifyToHtml(postText) }}
						/>
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

	const menuItems = React.useMemo(() => {
		const menuItems: any[] = [];

		menuItems.push({
			label: "Reply",
			key: "reply",
			action: () => setReplyingToPostId(props.threadId)
		});

		if (props.post.creatorId === currentUserId) {
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
