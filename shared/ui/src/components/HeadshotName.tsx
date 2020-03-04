import React from "react";
import styled from "styled-components";
import { Headshot } from "./Headshot";
import { useDispatch, useSelector } from "react-redux";
import { CodeStreamState } from "@codestream/webview/store";
import { getActivity } from "@codestream/webview/store/activityFeed/reducer";
import * as userSelectors from "../../store/users/reducer";

// this displays a headshot and the username after it

export interface HeadshotNameProps {
	person?: {
		email?: string;
		avatar?: { image?: string; image48?: string };
		fullName?: string;
		username?: string;
		color?: number;
	};
	id?: string;
	size?: number;
	onClick?: React.MouseEventHandler;
	className?: string;
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
`;

const HeadshotWrapper = styled.span`
	display: inline-block;
	padding-right: 5px;
	vertical-align: -5px;
`;

export function HeadshotName(props: HeadshotNameProps) {
	const derivedState = useSelector((state: CodeStreamState) => {
		return { users: state.users };
	});
	const person = props.person || derivedState.users[props.id || ""];
	if (!person) return null;
	return (
		<Root className={props.className} onClick={props.onClick}>
			<HeadshotWrapper>
				<Headshot person={person} size={props.size || 20} className={props.className} />
			</HeadshotWrapper>
			<span className="headshot-name">{person.username}</span>
		</Root>
	);
}
