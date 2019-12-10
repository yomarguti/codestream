import React from "react";
import { Modal, ModalProps } from "./Modal";
import { BoxedContent } from "../src/components/BoxedContent";
import { Headshot } from "../src/components/Headshot";
import { SharingControls, SharingAttributes } from "./SharingControls";
import styled from "styled-components";
import { Spacer } from "./SpatialView/PRInfoModal";
import { Button } from "../src/components/Button";
import { CodemarkPlus, CreateThirdPartyPostRequestType } from "@codestream/protocols/agent";
import { HostApi } from "..";
import { useSelector } from "react-redux";
import { CodeStreamState } from "../store";
import { Card, CardBody } from "../src/components/Card";
import Timestamp from "./Timestamp";
import { findMentionedUserIds, getTeamMembers } from "../store/users/reducer";
import { uniq } from "lodash-es";
import { logError } from "../logger";
import { useMarkdownifyToHtml } from "./Markdowner";

const StyledCard = styled(Card)``;

const StyledBox = styled(BoxedContent)`
	${StyledCard} {
		margin-bottom: 10px;
	}
`;

const VerticallyCentered = styled.div`
	height: inherit;
	display: flex;
	flex-direction: column;
	justify-content: center;
	min-width: 350px;
	max-width: 450px;
	margin: 0 auto;
`;

const ButtonRow = styled.div`
	display: flex;
	justify-content: flex-end;
	> *:nth-child(2) {
		margin-left: 10px;
	}
`;

const CardHeader = styled.div`
	width: 100%;
	margin-bottom: 8px;
	display: flex;
	font-size: 13px;
	font-weight: 700;
`;

const AuthorInfo = styled.div`
	display: flex;
	align-items: center;
	${Headshot} {
		margin-right: 7px;
	}
`;

const StyledTimestamp = styled(Timestamp)`
	opacity: 0.4;
	font-size: 11px;
	padding-left: 5px;
	.details {
		padding-left: 5px;
		transition: opacity 0.4s;
	}
`;

const CardTitle = styled.div`
	margin-bottom: 10px;
`;

const LinkifiedText = styled.span`
	white-space: normal;
	text-overflow: initial;
	p {
		margin: 0;
	}
`;

const SuccessMessage = styled.p`
	color: ${props => props.theme.colors.success};
	margin: 5px 0;
`;

const ErrorMessage = styled.p`
	color: ${props => props.theme.colors.error};
	margin: 5px 0;
`;

type FormStateType = "not-ready" | "ready" | "submitted" | "failure" | "success";

interface SharingModalProps extends ModalProps {
	codemark: CodemarkPlus;
}

export function SharingModal(props: SharingModalProps) {
	const { author, mentionedUserIds } = useSelector((state: CodeStreamState) => ({
		author: state.users[props.codemark.creatorId],
		mentionedUserIds: uniq([
			...findMentionedUserIds(getTeamMembers(state), props.codemark.text || ""),
			...findMentionedUserIds(getTeamMembers(state), props.codemark.title || "")
		])
	}));

	const valuesRef = React.useRef<SharingAttributes>();
	const [state, setState] = React.useState<{ name: FormStateType; message?: string }>({
		name: "not-ready"
	});

	const handleValues = React.useCallback(
		v => {
			valuesRef.current = v;
			if (v != undefined && state.name == "not-ready") {
				setState({ name: "ready" });
			} else if (v === undefined && state.name != "not-ready") {
				setState({ name: "not-ready" });
			}
		},
		[state.name]
	);

	const handleClickShare: React.MouseEventHandler = async e => {
		e.preventDefault();

		setState({ name: "submitted" });
		try {
			await HostApi.instance.send(CreateThirdPartyPostRequestType, {
				providerId: valuesRef.current!.providerId,
				channelId: valuesRef.current!.channelId,
				providerTeamId: valuesRef.current!.providerTeamId,
				text: props.codemark.text,
				codemark: props.codemark,
				mentionedUserIds
			});
			setState({ name: "success" });
		} catch (error) {
			setState({ name: "failure", message: error.message });
			logError("Failed to share an existing codemark", { message: error.message });
		}
	};

	const markdownifyToHtml = useMarkdownifyToHtml();

	return (
		<Modal onClose={props.onClose}>
			<VerticallyCentered>
				<StyledBox title="Share">
					{state.name === "success" && (
						<>
							<SuccessMessage>Codemark shared successfully!</SuccessMessage>
							<Spacer />
						</>
					)}
					{state.name === "failure" && (
						<>
							<ErrorMessage>There was an error sharing the codemark. {state.message}</ErrorMessage>
							<Spacer />
						</>
					)}
					<StyledCard>
						<CardBody>
							<CardHeader>
								<AuthorInfo>
									<Headshot person={author} /> {author.username}{" "}
									<StyledTimestamp time={props.codemark.createdAt} />
								</AuthorInfo>
							</CardHeader>
							<CardTitle>
								<LinkifiedText
									dangerouslySetInnerHTML={{
										__html: markdownifyToHtml(props.codemark.title || props.codemark.text)
									}}
								/>
							</CardTitle>
						</CardBody>
					</StyledCard>
					<SharingControls on onChangeValues={handleValues} />
					<Spacer />
					<ButtonRow>
						{state.name === "success" ? (
							<Button onClick={props.onClose}>Close</Button>
						) : (
							<>
								<Button variant="secondary" onClick={props.onClose}>
									Cancel
								</Button>
								<Button
									variant="primary"
									onClick={handleClickShare}
									disabled={state.name === "not-ready"}
									isLoading={state.name === "submitted"}
								>
									Share
								</Button>
							</>
						)}
					</ButtonRow>
				</StyledBox>
			</VerticallyCentered>
		</Modal>
	);
}
