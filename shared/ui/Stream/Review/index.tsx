import React from "react";
import { Card, CardBody } from "@codestream/webview/src/components/Card";
import styled from "styled-components";

export const ActivityReview = () => {
	return (
		<MinimumWidthCard>
			<CardBody>
				<Header>This is a review</Header>
			</CardBody>
		</MinimumWidthCard>
	);
};

const MinimumWidthCard = styled(Card)`
	min-width: 200px;
`;

const Header = styled.div`
	width: 100%;
	margin-bottom: 8px;
	display: flex;
	font-size: 13px;
	font-weight: 700;
`;
