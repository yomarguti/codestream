import { PropsWithChildren } from "react";
import React from "react";
import styled from "styled-components";
import { CSText } from "./CSText";

const Box = styled.div`
	border: 1px solid var(--base-border-color);
	box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);
	padding: 20px 20px 20px 20px;
	margin-bottom: 20px;
	position: relative;
	font-size: 14px;
`;

interface Props {
	title?: string;
	className?: string;
}

export function BoxedContent(props: PropsWithChildren<Props>) {
	return (
		<Box className={props.className}>
			{props.title && (
				<>
					<Title>
						<CSText as="h2">{props.title}</CSText>
					</Title>
					<div style={{ height: "5px" }} />
				</>
			)}
			{props.children}
		</Box>
	);
}

const Title = styled.span`
	position: absolute;
	top: -20px;
	left: 15px;
	background: var(--app-background-color);
	padding: 0 5px;
	margin: 0;
	display: inline-block;
`;
