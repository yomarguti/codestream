import { PropsWithChildren } from "react";
import React from "react";
import styled, { CSSProperties } from "styled-components";

const Header = styled.div`
	padding: 15px 20px 0 20px;
`;

const Title = styled.div`
	color: var(--text-color-highlight);
	font-size: 16px;
`;

interface Props {
	position?: "static" | "fixed";
	title?: string;
}

export function PanelHeader(props: PropsWithChildren<Props>) {
	const { position = "static" } = props;
	return (
		<Header style={{ position }}>
			{props.title && (
				<Title>
					{props.title}
					<div style={{ height: "5px" }} />
				</Title>
			)}
			{props.children}
		</Header>
	);
}
