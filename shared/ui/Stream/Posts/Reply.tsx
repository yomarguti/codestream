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
import { useSelector } from "react-redux";
import { emptyObject } from "@codestream/webview/utils";

export interface ReplyProps {
	author: Partial<CSUser>;
	post: PostPlus;
	nestedReplies?: PostPlus[];
	renderMenu?: (target: any, onClose: () => void) => React.ReactNode;
	className?: string;
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
	}

	${KebabIcon} {
		visibility: hidden;
	}

	&:hover ${KebabIcon} {
		visibility: visible;
	}
`;

export const Reply = (props: ReplyProps) => {
	const [menuState, setMenuState] = React.useState<{
		open: boolean;
		target?: any;
	}>({ open: false, target: undefined });

	const allUsers = useSelector((state: CodeStreamState) =>
		props.nestedReplies ? state.users : emptyObject
	);
	const codemark = useSelector((state: CodeStreamState) =>
		getCodemark(state.codemarks, props.post.codemarkId)
	);

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
			{emote ? null : (
				<>
					<MarkdownText
						style={{ marginLeft: "23px" }}
						dangerouslySetInnerHTML={{ __html: markdownifyToHtml(postText) }}
					/>
					{markers}
				</>
			)}
			{props.nestedReplies && props.nestedReplies.length > 0 && (
				<>
					{props.nestedReplies.map(r => (
						<NestedReply author={allUsers[r.creatorId]} post={r as PostPlus} />
					))}
				</>
			)}
		</Root>
	);
};

const NestedReply = styled(Reply)`
	padding-top: 10px;
	padding-left: 25px;
	padding-bottom: 0;
`;
