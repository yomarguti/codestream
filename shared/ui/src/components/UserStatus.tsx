import styled from "styled-components";
import React from "react";
import { CSUser } from "@codestream/protocols/api";
import { MarkdownText } from "@codestream/webview/Stream/MarkdownText";
import Icon from "@codestream/webview/Stream/Icon";
import { HostApi } from "@codestream/webview/webview-api";
import { OpenUrlRequestType } from "../../ipc/host.protocol";

const Root = styled.span`
	padding-left: 10px;
	display: inline-flex;
	align-items: top;
	.icon {
		margin-right: 5px;
	}
	&.has-link {
		cursor: pointer;
		&:hover {
			color: var(--text-color-info);
		}
	}
`;

const formatTheDate = time => {
	const date = new Date(time);
	return date.toLocaleString();
};

export function UserStatus(props: { user: CSUser; className?: string }) {
	const { status } = props.user;
	if (!status || !status.label) return null;

	const handleClick = () => {
		if (status.ticketUrl) {
			HostApi.instance.send(OpenUrlRequestType, { url: status.ticketUrl });
		}
	};

	return (
		<Root className={props.className + (status.ticketUrl ? " has-link" : "")} onClick={handleClick}>
			{status.ticketProvider && <Icon name={status.ticketProvider} />}
			<MarkdownText text={status.label} excludeParagraphWrap={true}></MarkdownText>
		</Root>
	);
}
