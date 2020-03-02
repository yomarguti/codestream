import { PropsWithChildren } from "react";
import React from "react";
import styled from "styled-components";
import { CSText } from "./CSText";
import Icon from "@codestream/webview/Stream/Icon";

const Box = styled.div`
	background: var(--base-background-color);
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
	onClose?(event: React.SyntheticEvent): any;
}

export function Dialog(props: PropsWithChildren<Props>) {
	return (
		<Box className={props.className}>
			{props.title && (
				<>
					<Title>
						<CSText as="h2">{props.title}</CSText>
					</Title>
					{props.onClose && (
						<Close className="close">
							<Icon className="clickable" name="x" onClick={props.onClose} />
						</Close>
					)}
					<div style={{ height: "5px" }} />
				</>
			)}
			{props.children}
		</Box>
	);
}

const Title = styled.div`
	h2 {
		text-align: center;
	}
`;

const Close = styled.span`
	position: absolute;
	top: 5px;
	right: 5px;
	padding: 5px;
	margin: 0;
	display: inline-block;
`;
