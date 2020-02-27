import styled from "styled-components";
import { useMarkdownifyToHtml } from "./Markdowner";
import React from "react";

export const MarkdownText = styled(
	(props: {
		text: string;
		as?: "string" | React.ElementType | React.Component;
		className?: string;
	}) => {
		const markdownifyToHtml = useMarkdownifyToHtml();

		return React.createElement(
			// casting to `any` on the next line because of a terrible type declaration for React.createElement that hardcodes the string 'input' as the first argument
			props.as || ("span" as any),
			{
				className: props.className,
				dangerouslySetInnerHTML: { __html: markdownifyToHtml(props.text) }
			},
			null
		);
	}
)`
	white-space: normal;
	text-overflow: initial;
	overflow-x: auto; // A long code snippet can extend past the container and look weird
	p {
		margin: 0;
	}
`;
