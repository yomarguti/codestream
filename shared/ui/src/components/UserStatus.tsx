import styled from "styled-components";
import React, { PropsWithChildren } from "react";
import { CSUser } from "@codestream/protocols/api";
import { emojiPlain } from "../../Stream/Markdowner";
import Tooltip from "../../Stream/Tooltip";
import { MarkdownText } from "@codestream/webview/Stream/MarkdownText";

const Root = styled.span`
	padding-left: 10px;
	display: inline-flex;
	align-items: top;
	.label {
		color: var(--text-color-subtle);
	}
	.emoji {
		vertical-align: -2px;
		padding-right: 3px;
		font-size: 16px;
	}
`;

const Tip = styled.div`
	font-size: 14px;
	text-align: center;
	.emoji {
		vertical-align: -2px;
		padding-right: 3px;
		font-size: 16px;
	}
`;

const formatTheDate = time => {
	const date = new Date(time);
	return date.toLocaleString();
};

export function UserStatus(props: { user: CSUser; className?: string }) {
	const { status } = props.user;
	if (!status) return null;
	if (!status.label && !status.icon) return null;
	const now = new Date().getTime();
	if (status.expires && status.expires < now) return null;

	const tip =
		status.expires && status.expires > 0 ? (
			<Tip>
				<div className="until">Until {formatTheDate(status.expires)}</div>
			</Tip>
		) : (
			undefined
		);

	return (
		<Tooltip title={tip} placement="bottom">
			<Root className={props.className}>
				<span className="emoji">{emojiPlain(status.icon)}</span>
				<span className="label">
					<MarkdownText text={status.label} excludeParagraphWrap={true}></MarkdownText>
				</span>
			</Root>
		</Tooltip>
	);
}
