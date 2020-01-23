import React from "react";
import styled from "styled-components";
import { Headshot } from "./Headshot";

// this displays a headshot and the username after it

export interface HeadshotNameProps {
	person: {
		email?: string;
		avatar?: { image?: string; image48?: string };
		fullName?: string;
		username?: string;
		color?: number;
	};
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
	return (
		<>
			<Root className={props.className} onClick={props.onClick}>
				<HeadshotWrapper>
					<Headshot person={props.person} size={props.size || 20} className={props.className} />
				</HeadshotWrapper>
				{props.person.username}
			</Root>
			&nbsp;
		</>
	);
}
