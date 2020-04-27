import React from "react";
import styled from "styled-components";
import { Headshot } from "./Headshot";
import { useSelector } from "react-redux";
import { CodeStreamState } from "@codestream/webview/store";
import cx from "classnames";
import Icon from "@codestream/webview/Stream/Icon";

// this displays a headshot and the username after it

export interface HeadshotNameProps {
	person?: {
		email?: string;
		avatar?: { image?: string; image48?: string };
		fullName?: string;
		username?: string;
		color?: number;
		id?: string;
	};
	id?: string;
	size?: number;
	onClick?: React.MouseEventHandler;
	className?: string;
	highlightMe?: boolean;
	addThumbsUp?: boolean;
}

interface ClickProps {
	hasOnClick?: boolean;
}

const Root = styled.div<ClickProps>`
	display: inline-block;
	padding: 0 10px 5px 0;
	white-space: nowrap;
	cursor: ${props => (props.onClick ? "pointer" : "auto")};
	&:hover {
		color: ${props => props.theme.colors.textHighlight};
	}
	&.no-padding {
		padding: 0;
	}
`;

export const HeadshotWrapper = styled.span`
	display: inline-block;
	padding-right: 5px;
	vertical-align: -5px;
`;

export function HeadshotName(props: HeadshotNameProps) {
	const derivedState = useSelector((state: CodeStreamState) => {
		return { users: state.users, currentUserId: state.session.userId };
	});
	const person = props.person || derivedState.users[props.id || ""];
	if (!person) return null;
	const me = props.highlightMe && person.id === derivedState.currentUserId;
	return (
		<Root className={props.className} onClick={props.onClick}>
			<HeadshotWrapper>
				<Headshot
					person={person}
					size={props.size || 20}
					className={props.className}
					hardRightBorder={me}
					addThumbsUp={props.addThumbsUp}
				/>
			</HeadshotWrapper>
			<span className={cx("headshot-name", { "at-mention me": me })}>{person.username}</span>
		</Root>
	);
}
