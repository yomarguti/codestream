import styled from "styled-components";
import React, { PropsWithChildren } from "react";

export const CSText = styled(
	(
		props: PropsWithChildren<{
			as?: "string" | React.ElementType | React.Component;
			align?: "left" | "right" | "center";
		}>
	) => {
		// casting to `any` on the next line because of a terrible type declaration for React.createElement that defines the string 'input' as the only valid first argument
		return React.createElement(props.as as any, undefined, props.children);
	}
)`
	margin: 5px 0;
	text-align: ${props => props.align};
`;

CSText.defaultProps = {
	as: "p",
	align: "left"
};
