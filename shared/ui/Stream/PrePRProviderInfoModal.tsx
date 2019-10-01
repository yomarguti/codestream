import styled from "styled-components";
import React from "react";
import { Button } from "../src/components/Button";
import Icon from "./Icon";
import { Modal } from "./Modal";
import { PROVIDER_MAPPINGS } from "./CrossPostIssueControls/types";
import { BoxedContent } from "../src/components/BoxedContent";
import { CSText } from "../src/components/CSText";

const VerticallyCentered = styled.div`
	height: inherit;
	display: flex;
	flex-direction: column;
	justify-content: center;
	min-width: 350px;
	max-width: 450px;
	margin: 0 auto;
	.octicon {
		vertical-align: middle;
	}
`;

const Spacer = styled.div`
	height: 10px;
`;

export interface PrePRProviderInfoModalProps {
	onClose: () => void;
	providerName: string;
	action: () => void;
	helpText?: string;
}

export const PrePRProviderInfoModal = (props: PrePRProviderInfoModalProps) => {
	const { displayName, icon } = PROVIDER_MAPPINGS[props.providerName];

	const onClickConnect = e => {
		e.preventDefault();
		props.action();
		props.onClose();
	};

	return (
		<Modal {...props}>
			<VerticallyCentered>
				<BoxedContent title={`${displayName} Integration`}>
					<CSText as="h3">
						<strong>
							<Icon name="bug" /> Issue Tracking
						</strong>
					</CSText>
					<CSText>
						See a problem in the code? Simply select it and then create an issue on {displayName}{" "}
						directly from CodeStream.
					</CSText>
					<Spacer />
					<CSText as="h3">
						<strong>
							<Icon name="comment" /> Pull Requests
						</strong>
					</CSText>
					<CSText>
						Display comments on merged-in pull requests right along side the code blocks they refer
						to. {props.helpText ? `(${props.helpText})` : null}
					</CSText>
					<Spacer />
					<Button fillParent prependIcon={<Icon name={icon!} />} onClick={onClickConnect}>
						<strong>Connect to {displayName}</strong>
					</Button>
				</BoxedContent>
			</VerticallyCentered>
		</Modal>
	);
};
