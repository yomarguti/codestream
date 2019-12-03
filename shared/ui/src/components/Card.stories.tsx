import { Card } from "./Card";
import React from "react";
import styled from "styled-components";

export default {
	title: "Card",
	component: Card
};

const P = styled.p`
	color: ${props => props.theme.colors.text};
	padding: 0;
	margin: 0;
`;

export const basic = () => (
	<Card>
		<P>This is a card</P>
	</Card>
);

export const withHoverHighlight = () => (
	<Card hoverEffect>
		<P>Hover over me</P>
	</Card>
);

export const withBanner = () => (
	<Card hoverEffect banner={<P>This is a banner for the card</P>}>
		<P>This is a card</P>
	</Card>
);
