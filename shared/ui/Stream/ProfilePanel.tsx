import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ScrollBox from "./ScrollBox";
import styled from "styled-components";
import { includes as _includes, sortBy as _sortBy, last as _last } from "lodash-es";
import { CodeStreamState } from "../store";
import { useDidMount } from "../utilities/hooks";
import { HostApi } from "../webview-api";
import { PanelHeader } from "../src/components/PanelHeader";
import { openPanel } from "./actions";
import Icon from "./Icon";
import { Button } from "../src/components/Button";
import { DropdownButton } from "./Review/DropdownButton";
import { Headshot } from "../src/components/Headshot";
import { MetaLabel } from "./Codemark/BaseCodemark";
import { WebviewPanels } from "../ipc/webview.protocol.common";
import Timestamp from "./Timestamp";

const Root = styled.div`
	padding: 20px;
	h1 {
		margin-bottom: 0;
		.icon {
			margin-left: 10px;
			vertical-align: -8px;
		}
	}
	.edit-headshot {
		position: relative;
		cursor: pointer;
		width: 128px;
		.icon {
			position: absolute;
			bottom: 5px;
			right: 5px;
			visibility: hidden;
			background: var(--app-background-color);
			color: var(--text-color-highlight);
			border-radius: 5px;
			padding: 5px;
			z-index: 5;
		}
		&:hover .icon {
			visibility: visible;
		}
	}
`;
const Value = styled.span`
	padding-right: 10px;
`;
const Row = styled.div`
	margin-bottom: 15px;
	.icon {
		margin-right: 10px;
		opacity: 0.7;
		visibility: hidden;
		pointer-events: none;
	}
	&:hover .icon {
		visibility: visible;
		pointer-events: auto;
	}
	time {
		color: var(--text-color) !important;
		padding: 0 !important;
	}
`;

const RowIcon = ({ name, title, onClick }) => {
	return (
		<Icon
			name={name}
			title={title}
			onClick={onClick}
			placement="bottom"
			delay={0.5}
			className="clickable"
		/>
	);
};

export const ProfilePanel = () => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const { session, users, context } = state;
		const person = users[context.profileUserId!];

		return {
			person,
			isMe: person ? person.id === session.userId : false,
			webviewFocused: state.context.hasFocus
		};
	});

	const { person, isMe } = derivedState;

	useDidMount(() => {
		if (derivedState.webviewFocused)
			HostApi.instance.track("Page Viewed", { "Page Name": "Profile" });
	});

	if (!derivedState.person) {
		return (
			<div className="panel full-height">
				<PanelHeader title={<>&nbsp;</>}></PanelHeader>
				<ScrollBox>
					<div className="channel-list vscroll">person not found</div>
				</ScrollBox>
			</div>
		);
	}

	const editUsername = () => dispatch(openPanel(WebviewPanels.ChangeUsername));
	const editEmail = () => dispatch(openPanel(WebviewPanels.ChangeEmail));
	const editAvatar = () => dispatch(openPanel(WebviewPanels.ChangeAvatar));
	const editFullName = () => dispatch(openPanel(WebviewPanels.ChangeFullName));
	const editPhoneNumber = () => dispatch(openPanel(WebviewPanels.ChangePhoneNumber));
	const editWorksOn = () => dispatch(openPanel(WebviewPanels.ChangeWorksOn));
	const copyEmail = () => {};
	const noop = () => {};

	return (
		<div className="panel full-height">
			<PanelHeader title={<>&nbsp;</>}></PanelHeader>
			<ScrollBox>
				<div className="channel-list vscroll">
					<Root>
						<div
							className={isMe ? "edit-headshot" : "headshot-wrap"}
							onClick={isMe ? editAvatar : noop}
						>
							<Headshot person={person} size={128} />
							{isMe && <RowIcon name="pencil" title="Edit Profile Photo" onClick={editAvatar} />}
						</div>
						<Row>
							<h1>
								{person.fullName}
								{isMe && <RowIcon name="pencil" title="Edit Name" onClick={editFullName} />}
							</h1>
						</Row>
						<Row>
							<MetaLabel>Username</MetaLabel>
							<Value>@{person.username}</Value>
							{isMe && <RowIcon name="pencil" title="Edit Username" onClick={editUsername} />}
						</Row>
						<Row>
							<MetaLabel>Email address</MetaLabel>
							<Value>
								<a href={`mailto:${person.email}`}>{person.email}</a>
							</Value>
							<RowIcon name="copy" title="Copy Email" onClick={copyEmail} />
							{isMe && <RowIcon name="pencil" title="Edit Email" onClick={editEmail} />}
						</Row>
						<Row>
							<MetaLabel>Timezone</MetaLabel>
							<Value>{person.timeZone}</Value>
						</Row>
						{(isMe || person.phoneNumber) && (
							<Row>
								<MetaLabel>Phone Number</MetaLabel>
								<Value>{person.phoneNumber || "-not set-"}</Value>
								{isMe && <RowIcon name="pencil" title="Edit Phone" onClick={editPhoneNumber} />}
							</Row>
						)}
						{(isMe || person.iWorkOn) && (
							<Row>
								<MetaLabel>Works On</MetaLabel>
								<Value>{person.iWorkOn || "-not set-"}</Value>
								{isMe && <RowIcon name="pencil" title="Edit Works On" onClick={editWorksOn} />}
							</Row>
						)}
						{person.lastLogin && (
							<Row>
								<MetaLabel>Last Login</MetaLabel>
								<Value>
									<Timestamp className="no-padding" time={person.lastLogin} relative />
								</Value>
							</Row>
						)}
						{false && (
							<Row>
								<MetaLabel>Presence</MetaLabel>
								<Value></Value>
							</Row>
						)}
						{false && (
							<Row>
								<MetaLabel>Status</MetaLabel>
								<Value></Value>
							</Row>
						)}
					</Root>
				</div>
			</ScrollBox>
		</div>
	);
};
