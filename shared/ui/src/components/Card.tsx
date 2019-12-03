import React from "react";
import styled from "styled-components";
import { PropsWithTheme, isDarkTheme } from "../themes";

export interface CardProps {
	hoverEffect?: boolean;
	banner?: React.ReactNode;
}

const Root = styled.div((props: PropsWithTheme<CardProps>) => {
	const { theme } = props;
	const boxShadow = isDarkTheme(theme)
		? "0 5px 10px rgba(0, 0, 0, 0.2)"
		: "0 2px 5px rgba(0, 0, 0, 0.08)";

	return `
		display: flex;
  	box-shadow: ${boxShadow};
    background: ${theme.colors.baseBackground};
    border: 1px solid ${theme.colors.baseBorder};
  `;
});

const Content = styled.div`
	width: 100%;
	height: 100%;
	padding: 10px;
	position: relative;
	background-color: transparent;
	${(props: PropsWithTheme<CardProps>) => {
		if (!props.hoverEffect) return "";

		return `
		${Root}:hover & {
			color: ${({ theme }) => theme.colors.textHighlight};
			background: rgba(127, 127, 127, 0.05);
		}`;
	}}
`;

const Banner = styled.div`
	margin-top: -10px;
	margin-left: -10px;
	margin-bottom: 10px;
	padding: 10px;
	width: 100%;
	border-bottom: 1px solid ${props => props.theme.colors.baseBorder};
	background: repeating-linear-gradient(
		-45deg,
		transparent,
		transparent 5px,
		${props => props.theme.colors.appBackground} 5px,
		${props => props.theme.colors.appBackground} 10px
	);
`;

const Body = styled.div`
	display: flex;
	flex-direction: column;
	white-space: nowrap;
	text-overflow: ellipsis;
	overflow-x: hidden;
`;

export function Card(props: React.PropsWithChildren<CardProps>) {
	const { banner: bannerContent, hoverEffect } = props;
	return (
		<Root>
			<Content hoverEffect={hoverEffect}>
				{bannerContent && <Banner>{bannerContent}</Banner>}
				<Body>{props.children}</Body>
			</Content>
		</Root>
	);
}
