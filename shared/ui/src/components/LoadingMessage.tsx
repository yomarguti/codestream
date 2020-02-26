import styled from "styled-components";
import React, { PropsWithChildren } from "react";
import Icon from "@codestream/webview/Stream/Icon";

interface Props extends PropsWithChildren<{}> {
	align?: "left" | "right" | "center";
	theRef?: any;
}

const Root = styled.div<Props>`
	padding: 10px 20px;
	margin: 0 auto;
	text-align: ${props => props.align};
	.icon {
		margin-right: 5px;
		vertical-align: 2px;
	}
`;

export const LoadingMessage = (props: Props) => {
	return (
		<Root align={props.align} ref={props.theRef}>
			<Icon className="spin" name="sync" />
			{props.children}
		</Root>
	);
};

LoadingMessage.defaultProps = {
	align: "center"
};
