import styled from "styled-components";
import { CSUser } from "@codestream/protocols/api";
import { PostPlus } from "@codestream/protocols/agent";
import React from "react";
import { useMarkdownifyToHtml } from "../Markdowner";
import { Headshot } from "@codestream/webview/src/components/Headshot";
import { StyledTimestamp, MarkdownText, KebabIcon } from "../Codemark/BaseCodemark";
import Icon from "../Icon";

export interface ReplyProps {
	author: Partial<CSUser>;
	post: PostPlus;
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

export const Reply = styled((props: ReplyProps) => {
	const [menuState, setMenuState] = React.useState<{
		open: boolean;
		target?: any;
	}>({ open: false, target: undefined });

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

	return (
		<div className={props.className}>
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
				<MarkdownText
					style={{ marginLeft: "23px" }}
					dangerouslySetInnerHTML={{ __html: markdownifyToHtml(props.post.text) }}
				/>
			)}
		</div>
	);
})`
	padding-bottom: 10px;
	display: flex;
	flex-direction: column;
	${AuthorInfo} {
		font-weight: 700;
	}
`;
