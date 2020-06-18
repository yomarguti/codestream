import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ScrollBox from "./ScrollBox";
import styled from "styled-components";
import { includes as _includes, sortBy as _sortBy, last as _last } from "lodash-es";
import { CodeStreamState } from "../store";
import { useDidMount } from "../utilities/hooks";
import { HostApi } from "../webview-api";
import { PanelHeader } from "../src/components/PanelHeader";
import { openPanel, closePanel } from "./actions";
import Icon from "./Icon";
import { Button } from "../src/components/Button";
import { DropdownButton } from "./Review/DropdownButton";
import { Headshot } from "../src/components/Headshot";
import { MetaLabel } from "./Codemark/BaseCodemark";
import { WebviewPanels } from "../ipc/webview.protocol.common";
import Timestamp from "./Timestamp";
import Tooltip from "./Tooltip";
import { getCodeCollisions } from "../store/users/reducer";
import { ChangesetFile } from "./Review/ChangesetFile";
import { UL } from "./TeamPanel";
import CancelButton from "./CancelButton";
import { UserStatus } from "../src/components/UserStatus";

const Root = styled.div`
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
	.edit-headshot,
	.headshot-wrap {
		float: right;
		margin: 20px 0 10px 10px;
		@media only screen and (max-width: 430px) {
			float: none;
			margin: 20px 0 10px 0;
		}
	}
`;

const Value = styled.span`
	padding-right: 10px;
`;

const Row = styled.div`
	margin-bottom: 15px;
	.row-icon {
		margin-right: 10px;
		opacity: 0.7;
		visibility: hidden;
		pointer-events: none;
	}
	&:hover .row-icon {
		visibility: visible;
		pointer-events: auto;
	}
	time {
		color: var(--text-color) !important;
		padding: 0 !important;
	}
`;

const StyledUserStatus = styled(UserStatus)`
	padding-left: 0;
	padding-right: 10px;
`;

const RowIcon = ({ name, title, onClick }) => {
	return (
		<Icon
			name={name}
			title={title}
			onClick={onClick}
			placement="bottom"
			delay={0.5}
			className="clickable row-icon"
		/>
	);
};

export const ProfilePanel = () => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const { session, users, teams, context } = state;
		const person = users[context.profileUserId!];
		const me = users[session.userId!];
		const team = teams[context.currentTeamId];
		const xraySetting = team.settings ? team.settings.xray : "";
		const xrayEnabled = xraySetting !== "off";

		return {
			person,
			isMe: person ? person.id === session.userId : false,
			webviewFocused: state.context.hasFocus,
			repos: state.repos,
			teamId: state.context.currentTeamId,
			currentUserEmail: me.email,
			collisions: getCodeCollisions(state),
			xrayEnabled
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
	const editStatus = () => dispatch(openPanel(WebviewPanels.Status));
	const editFullName = () => dispatch(openPanel(WebviewPanels.ChangeFullName));
	const editPhoneNumber = () => dispatch(openPanel(WebviewPanels.ChangePhoneNumber));
	const editWorksOn = () => dispatch(openPanel(WebviewPanels.ChangeWorksOn));
	const copyEmail = () => {
		if (emailRef && emailRef.current) {
			emailRef.current.select();
			document.execCommand("copy");
		}
	};
	const noop = () => {};

	const emailRef = React.useRef<HTMLTextAreaElement>(null);

	const renderModifiedRepos = () => {
		const { repos, teamId, currentUserEmail, collisions, xrayEnabled } = derivedState;
		const { modifiedRepos, modifiedReposModifiedAt } = person;

		if (!xrayEnabled) return null;
		if (!modifiedRepos || !modifiedRepos[teamId] || !modifiedRepos[teamId].length) return null;

		const modified = modifiedRepos[teamId]
			.map(repo => {
				const { repoId = "", authors, modifiedFiles } = repo;
				if (modifiedFiles.length === 0) return null;
				const repoName = repos[repoId] ? repos[repoId].name : "";
				const added = modifiedFiles.reduce((total, f) => total + f.linesAdded, 0);
				const removed = modifiedFiles.reduce((total, f) => total + f.linesRemoved, 0);
				const stomp =
					person.email === currentUserEmail
						? null
						: (authors || []).find(a => a.email === currentUserEmail && a.stomped > 0);
				return (
					<li
						className="status row-with-icon-actions"
						style={{ overflow: "hidden", whiteSpace: "nowrap", paddingLeft: "0" }}
					>
						<div style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
							<Icon name="repo" /> {repoName} &nbsp; <Icon name="git-branch" /> {repo.branch}
						</div>
						<div style={{ padding: "5px 0 10px 25px" }}>
							{modifiedFiles.map(f => {
								const className = collisions.userRepoFiles[
									person.id + ":" + repo.repoId + ":" + f.file
								]
									? "file-has-conflict"
									: "";
								return <ChangesetFile className={className} noHover={true} key={f.file} {...f} />;
							})}
						</div>
						{stomp && (
							<div style={{ paddingTop: "5px" }}>
								<span className="stomped" style={{ paddingLeft: 0 }}>
									@{stomp.stomped}
								</span>{" "}
								= includes {stomp.stomped} change
								{stomp.stomped > 1 ? "s" : ""} to code you wrote
							</div>
						)}
						{collisions.userRepos[person.id + ":" + repo.repoId] && (
							<div style={{ paddingTop: "5px" }}>
								<Icon name="alert" className="conflict" /> = possible merge conflict
							</div>
						)}
					</li>
				);
			})
			.filter(Boolean);

		if (modified.length > 0) {
			return (
				<>
					<MetaLabel>Local Modifications</MetaLabel>
					<UL>{modified}</UL>
					{modifiedReposModifiedAt && modifiedReposModifiedAt[teamId] && (
						<div style={{ color: "var(--text-color-subtle)" }}>
							Updated
							<Timestamp relative time={modifiedReposModifiedAt[teamId]} />
						</div>
					)}
				</>
			);
		} else return null;
	};

	const title = (
		<Row style={{ margin: 0 }}>
			<Value>{person.fullName}</Value>
			{isMe && <RowIcon name="pencil" title="Edit Name" onClick={editFullName} />}
		</Row>
	);
	return (
		<Root>
			<div className="panel full-height">
				<PanelHeader title={title}>
					<CancelButton title="Close" onClick={() => dispatch(closePanel())} />
				</PanelHeader>
				<ScrollBox>
					<div className="channel-list vscroll" style={{ padding: "0 20px 20px 20px" }}>
						<div
							className={isMe ? "edit-headshot" : "headshot-wrap"}
							onClick={isMe ? editAvatar : noop}
						>
							<Headshot person={person} size={128} />
							{isMe && <RowIcon name="pencil" title="Edit Profile Photo" onClick={editAvatar} />}
						</div>
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
							<textarea
								ref={emailRef}
								value={person.email}
								style={{ position: "absolute", left: "-9999px" }}
							/>
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
						{person.status && person.status.label && (
							<Row>
								<MetaLabel>Currently Working On</MetaLabel>
								<StyledUserStatus user={person} />
								{isMe && <RowIcon name="pencil" title="Edit Status" onClick={editStatus} />}
							</Row>
						)}
						{renderModifiedRepos()}
					</div>
				</ScrollBox>
			</div>
		</Root>
	);
};
