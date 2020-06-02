import React from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import Icon from "./Icon";
import Button from "./Button";
import Headshot from "./Headshot";
import ScrollBox from "./ScrollBox";
import { invite, setUserStatus } from "./actions";
import { mapFilter, keyFilter } from "../utils";
import { difference as _difference, sortBy as _sortBy } from "lodash-es";
import { OpenUrlRequestType } from "../ipc/host.protocol";
import { getTeamProvider } from "../store/teams/reducer";
import { HostApi } from "../webview-api";
import { WebviewPanels } from "@codestream/protocols/webview";
import { PanelHeader } from "../src/components/PanelHeader";
import {
	RepoScmStatus,
	DidChangeDataNotificationType,
	ChangeDataType,
	KickUserRequestType,
	UpdateTeamRequestType,
	UpdateTeamSettingsRequestType,
	UpdateTeamAdminRequestType,
	GetLatestCommittersRequestType
} from "@codestream/protocols/agent";
import { CSUser } from "@codestream/protocols/api";
import { ChangesetFile } from "./Review/ChangesetFile";
import Tooltip from "./Tooltip";
import { DocumentData } from "../protocols/agent/agent.protocol.notifications";
import { updateModifiedRepos, clearModifiedFiles } from "../store/users/actions";
import { CSText } from "../src/components/CSText";
import cx from "classnames";
import Timestamp from "./Timestamp";
import { DropdownButton } from "./Review/DropdownButton";
import { confirmPopup } from "./Confirm";
import styled from "styled-components";
import { getCodeCollisions } from "../store/users/reducer";
import { openPanel } from "../store/context/actions";
import { isFeatureEnabled } from "../store/apiVersioning/reducer";
import { ProfileLink } from "../src/components/ProfileLink";
import copy from "copy-to-clipboard";
import { CreateCodemarkIcons } from "./CreateCodemarkIcons";
import { SelectPeople } from "../src/components/SelectPeople";
import { HeadshotName } from "../src/components/HeadshotName";

const EMAIL_REGEX = new RegExp(
	"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
);

export const UL = styled.ul`
	margin: 0;
	padding: 0;
	li:hover,
	li.active {
		opacity: 1;
		color: var(--text-color-highlight);
		background: var(--app-background-color-hover);
	}
	li {
		position: relative;
		font-weight: normal;
		padding: 3px 20px 2px 20px;
		// cursor: pointer;
		list-style: none;
		overflow: hidden;
		text-overflow: ellipsis;
		.icon:not(.chevron-down) {
			top: 2px !important;
			margin-right: 5px;
		}
	}
	li:hover {
		span.align-right {
			display: inline-block;
		}
	}
	li.muted {
		opacity: 0.5;
	}
`;

const HR = styled.div`
	width: 100%;
	height: 1px;
	border-bottom: 1px solid var(--base-border-color);
	margin: 20px 0 0 0;
`;

const MapRow = styled.div`
	display: flex;
	margin: 0px 10px;
	> div {
		width: calc(50% - 10px);
		flex-grow: 1;
		padding: 3px 10px;
	}
`;

interface Props extends ConnectedProps {}

interface ConnectedProps {
	isCodeStreamTeam: boolean;
	webviewFocused: boolean;
	teamId: string;
	activePanel: WebviewPanels;
	invite: Function;
	invited: any[];
	teamName: string;
	teamPlan: any;
	companyMemberCount: number;
	teamProvider: any;
	members: CSUser[];
	repos: any;
	currentUserInvisible: false;
	updateModifiedRepos: Function;
	clearModifiedFiles: Function;
	currentUserEmail: string;
	currentUserId: string;
	xraySetting: string;
	xrayEnabled: boolean;
	reviewApproval: "user" | "anyone" | "all";
	setUserStatus: Function;
	openPanel: Function;
	isCurrentUserAdmin: boolean;
	adminIds: string[];
	collisions: any;
	dontSuggestInvitees: any;
	multipleReviewersApprove: boolean;
	emailSupported: boolean;
	blameMap: { [email: string]: string };
}

interface State {
	loading: boolean;
	isInviting: boolean;
	invitingEmails: any;
	newMemberEmail: string;
	newMemberEmailInvalid: boolean;
	newMemberName: string;
	newMemberInvalid: boolean;
	newMemberInputTouched: boolean;
	inputTouched: boolean;
	modifiedRepos: RepoScmStatus[];
	loadingStatus: boolean;
	changingTeamName: boolean;
	newTeamName: string;
	suggested: any[];
	blameMapEmail: string;
	addingBlameMap: boolean;
}

class TeamPanel extends React.Component<Props, State> {
	initialState = {
		loading: false,
		isInviting: false,
		invitingEmails: {},
		newMemberEmail: "",
		newMemberName: "",
		newMemberInvalid: false,
		newMemberInputTouched: false,
		inputTouched: false,
		newMemberEmailInvalid: false,
		modifiedRepos: [],
		loadingStatus: false,
		changingTeamName: false,
		newTeamName: "",
		suggested: [],
		blameMapEmail: "",
		addingBlameMap: false
	};

	postInviteResetState = {
		loadingStatus: false,
		changingTeamName: false,
		loading: false,
		isInviting: false,
		newMemberEmail: "",
		newMemberName: "",
		newMemberInvalid: false,
		newMemberInputTouched: false,
		inputTouched: false,
		newMemberEmailInvalid: false
	};

	private _pollingTimer?: any;
	private _mounted: boolean = false;
	private disposables: { dispose(): void }[] = [];

	constructor(props: Props) {
		super(props);
		this.state = this.initialState;
	}

	componentDidMount() {
		this._mounted = true;
		if (this.props.webviewFocused)
			HostApi.instance.track("Page Viewed", { "Page Name": "Team Tab" });

		this.disposables.push(
			HostApi.instance.on(DidChangeDataNotificationType, (e: any) => {
				// if we have a change to scm OR a file has been saved, update
				if (
					e.type === ChangeDataType.Commits ||
					(e.type === ChangeDataType.Documents &&
						e.data &&
						(e.data as DocumentData).reason === "saved")
				) {
					this.getScmInfoSummary();
				}
			})
		);

		this.getSuggestedInvitees();

		if (this.props.currentUserInvisible) this.clearScmInfoSummary();
		else this.getScmInfoSummary();

		this.startPolling();
	}

	componentWillUnmount() {
		this._mounted = false;
		this.disposables.forEach(d => d.dispose());
		this.stopPolling();
	}

	getSuggestedInvitees = async () => {
		// for now, suggested invitees are only available to admins
		if (!this.props.isCurrentUserAdmin) return;

		const result = await HostApi.instance.send(GetLatestCommittersRequestType, {});
		const committers = result ? result.scm : undefined;
		if (!committers) return;

		const { members, invited, dontSuggestInvitees } = this.props;
		const suggested: any[] = [];
		Object.keys(committers).forEach(email => {
			if (members.find(user => user.email === email)) return;
			if (invited.find(user => user.email === email)) return;
			if (dontSuggestInvitees[email.replace(".", "*")]) return;
			suggested.push({ email, fullName: committers[email] || email });
		});
		this.setState({ suggested });
	};

	private startPolling() {
		// poll to get any changes that might happen outside the scope of
		// the documentManager operations
		if (!this._mounted || this._pollingTimer !== undefined) return;

		this._pollingTimer = setInterval(() => {
			this.getScmInfoSummary();
		}, 30000); // five minutes
	}

	private stopPolling() {
		if (this._pollingTimer === undefined) return;

		clearInterval(this._pollingTimer);
		this._pollingTimer = undefined;
	}

	getScmInfoSummary = async () => {
		await this.props.updateModifiedRepos();
	};

	clearScmInfoSummary = async () => {
		this.props.clearModifiedFiles();
	};

	onEmailChange = event => {
		this.setState({ newMemberEmail: event.target.value });
		if (this.state.newMemberEmailInvalid) {
			this.setState(state => ({
				newMemberEmailInvalid:
					state.newMemberEmail !== "" && EMAIL_REGEX.test(state.newMemberEmail) === false
			}));
		}
	};

	onEmailBlur = event => {
		this.setState(state => ({
			inputTouched: true,
			newMemberEmailInvalid:
				state.newMemberEmail !== "" && EMAIL_REGEX.test(state.newMemberEmail) === false
		}));
	};

	onNameChange = event => this.setState({ newMemberName: event.target.value });

	onSubmit = event => {
		event.preventDefault();
		const { newMemberEmail, newMemberName, newMemberEmailInvalid } = this.state;
		if (newMemberEmailInvalid || newMemberEmail === "") return;

		this.setState({ loading: true });
		this.props
			.invite({ email: newMemberEmail, fullName: newMemberName, teamId: this.props.teamId })
			.then(() => {
				this.setState(this.postInviteResetState);
			});
		HostApi.instance.track("Teammate Invited", {
			"Invitee Email Address": newMemberEmail,
			"Invitee Name": newMemberName,
			"Invitation Method": "Manual"
		});
	};

	onClickReinvite = (user, type) => {
		const { email, fullName } = user;
		this.setState({ invitingEmails: { ...this.state.invitingEmails, [email]: 1 } });
		this.props
			.invite({ email: user.email, fullName: user.fullName, teamId: this.props.teamId })
			.then(() => {
				// TODO: show notification
				// atom.notifications.addInfo(
				// 	this.props.intl.formatMessage({
				// 		id: "invitation.emailSent",
				// 		defaultMessage: `Invitation sent to ${user.email}!`
				// 	})
				// );
				this.setState({ invitingEmails: { ...this.state.invitingEmails, [email]: 2 } });
			});
		HostApi.instance.track("Teammate Invited", {
			"Invitee Email Address": user.email,
			"Invitee Name": user.fullName,
			"Invitation Method": type === "reinvite" ? "Reinvite" : "Suggested"
		});
	};

	componentDidUpdate(prevProps, prevState) {
		if (
			this.props.activePanel === WebviewPanels.People &&
			prevProps.activePanel !== this.props.activePanel
		) {
			setTimeout(() => {
				this.focusEmailInput();
			}, 500);
		}
	}

	focusEmailInput = () => {
		const input = document.getElementById("invite-email-input");
		if (input) input.focus();
	};

	renderEmailHelp = () => {
		const { newMemberEmailInvalid, inputTouched } = this.state;

		if (inputTouched && newMemberEmailInvalid) {
			return (
				<small className="error-message">
					<FormattedMessage id="login.email.invalid" />
				</small>
			);
		} else return null;
	};

	renderThirdParyInvite = provider => {
		return (
			<div style={{ padding: "30px", textAlign: "center" }}>
				Invite your teammates to give CodeStream a try by sharing this URL with them:
				<br />
				<br />
				<b>https://www.codestream.com/{provider}-invite</b>
				<br />
				<br />
			</div>
		);
	};

	renderInviteDisabled = () => {
		return (
			<div style={{ padding: "30px", textAlign: "center" }}>
				Contact <a href="mailto:sales@codestream.com">sales@codestream.com</a> to upgrade your plan
				if you'd like to invite more teammates.
				<br />
				<br />
			</div>
		);
	};

	// Post URL to{" "}
	// <select style={{ width: "auto" }}>
	// 	<option>#general</option>
	// </select>
	// <Button>Go</Button>

	renderFieldset = inactive => {
		const { newMemberEmail, newMemberName, isInviting } = this.state;

		if (
			this.props.teamPlan &&
			this.props.teamPlan === "FREEPLAN" &&
			(this.props.companyMemberCount || 0) >= 5
		) {
			return this.renderInviteDisabled();
		}

		// if there aren't very many people on the team, we can safely
		// auto-focus the invitation input. but when there are a lot,
		// auto-focus would cause scrolling which is undesireable.
		const autoFocus = this.props.companyMemberCount < 5;

		const inviteButtonId = this.props.emailSupported
			? "teamMemberSelection.invite"
			: "teamMemberSelection.getInviteCode";
		const inviteButtonWidth = this.props.emailSupported ? "60px" : "120px";

		return (
			<fieldset
				className="form-body"
				disabled={inactive}
				style={{ padding: "0", maxWidth: "none" }}
			>
				<div id="controls">
					<div style={{ display: "flex", alignItems: "flex-end" }}>
						<div className="control-group" style={{ flexGrow: 3 }}>
							<input
								className="input-text"
								id="invite-email-input"
								type="text"
								value={newMemberEmail}
								onChange={this.onEmailChange}
								onBlur={this.onEmailBlur}
								placeholder="Email..."
								autoFocus={autoFocus}
							/>
							{this.renderEmailHelp()}
						</div>
						<Button
							style={{ width: inviteButtonWidth, margin: "0 0 6px 10px" }}
							id="add-button"
							className="control-button"
							type="submit"
							loading={this.state.loading}
						>
							<FormattedMessage id={inviteButtonId} defaultMessage="Invite" />
						</Button>
					</div>
				</div>
			</fieldset>
		);
	};

	renderEmailUser(user, linkText = "reinvite") {
		const { invitingEmails } = this.state;
		switch (invitingEmails[user.email]) {
			case 1:
				return (
					<span className="float-right">
						<Icon className="spin" name="sync" />
					</span>
				);
			case 2:
				return <span className="float-right">email sent</span>;
			default:
				return (
					<a
						className="float-right"
						onClick={event => {
							event.preventDefault();
							this.onClickReinvite(user, linkText);
						}}
					>
						{linkText}
					</a>
				);
		}
	}

	revoke(user: CSUser) {
		const { teamId } = this.props;
		HostApi.instance.send(UpdateTeamAdminRequestType, { teamId, remove: user.id });
	}

	promote(user: CSUser) {
		const { teamId } = this.props;
		HostApi.instance.send(UpdateTeamAdminRequestType, { teamId, add: user.id });
	}

	confirmKick(user: CSUser) {
		confirmPopup({
			title: "Are you sure?",
			message: "",
			centered: true,
			buttons: [
				{ label: "Go Back", className: "control-button" },
				{
					label: "Remove User",
					className: "delete",
					wait: true,
					action: () => this.kick(user)
				}
			]
		});
	}

	kick = (user: CSUser) => {
		const { teamId } = this.props;
		HostApi.instance.send(KickUserRequestType, { teamId, userId: user.id });
	};

	renderAdminUser(user: CSUser) {
		const { isCurrentUserAdmin, adminIds } = this.props;

		const revokeAdmin = { label: "Revoke Admin", action: () => this.revoke(user) };
		const promoteAdmin = { label: "Make Admin", action: () => this.promote(user) };
		const kickUser = { label: "Remove from Team", action: () => this.confirmKick(user) };

		const isUserAdmin = adminIds.includes(user.id);
		if (isCurrentUserAdmin && user.id !== this.props.currentUserId) {
			if (isUserAdmin) {
				return (
					<span className="float-right">
						<DropdownButton variant="text" items={[revokeAdmin]}>
							Admin
						</DropdownButton>
					</span>
				);
			} else {
				return (
					<span className="float-right">
						<DropdownButton variant="text" items={[promoteAdmin, kickUser]}>
							Member
						</DropdownButton>
					</span>
				);
			}
		} else {
			if (isUserAdmin) return <span className="float-right">Admin</span>;
		}
		return null;
	}

	renderModifiedRepos(user) {
		const { repos, teamId, currentUserEmail, collisions, xrayEnabled } = this.props;
		const { modifiedRepos, modifiedReposModifiedAt } = user;

		if (!xrayEnabled) return null;
		if (!modifiedRepos || !modifiedRepos[teamId] || !modifiedRepos[teamId].length) return null;

		return modifiedRepos[teamId].map(repo => {
			const { repoId = "", authors, modifiedFiles } = repo;
			if (modifiedFiles.length === 0) return null;
			const repoName = repos[repoId] ? repos[repoId].name : "";
			const added = modifiedFiles.reduce((total, f) => total + f.linesAdded, 0);
			const removed = modifiedFiles.reduce((total, f) => total + f.linesRemoved, 0);
			const stomp =
				user.email === currentUserEmail
					? null
					: (authors || []).find(a => a.email === currentUserEmail && a.stomped > 0);
			const title = (
				<div style={{ maxWidth: "60vw" }}>
					<div className="related-label">Local Changes</div>
					{modifiedFiles.map(f => {
						const className = collisions.userRepoFiles[user.id + ":" + repo.repoId + ":" + f.file]
							? "file-has-conflict"
							: "";
						return <ChangesetFile className={className} noHover={true} key={f.file} {...f} />;
					})}
					{stomp && (
						<div style={{ paddingTop: "5px" }}>
							<span className="stomped" style={{ paddingLeft: 0 }}>
								@{stomp.stomped}
							</span>{" "}
							= includes {stomp.stomped} change
							{stomp.stomped > 1 ? "s" : ""} to code you wrote
						</div>
					)}
					{collisions.userRepos[user.id + ":" + repo.repoId] && (
						<div style={{ paddingTop: "5px" }}>
							<Icon name="alert" className="conflict" /> = possible merge conflict
						</div>
					)}
					{modifiedReposModifiedAt && modifiedReposModifiedAt[teamId] && (
						<div style={{ paddingTop: "5px", color: "var(--text-color-subtle)" }}>
							Updated
							<Timestamp relative time={modifiedReposModifiedAt[teamId]} />
						</div>
					)}
				</div>
			);
			return (
				<li
					className="status row-with-icon-actions"
					style={{ overflow: "hidden", whiteSpace: "nowrap", paddingLeft: "48px" }}
				>
					<Tooltip title={title} placement="bottomRight" delay={1}>
						<div style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
							<Icon name="repo" /> {repoName} &nbsp; <Icon name="git-branch" /> {repo.branch}
							{added > 0 && <span className="added">+{added}</span>}
							{removed > 0 && <span className="deleted">-{removed}</span>}
							{stomp && <span className="stomped">@{stomp.stomped}</span>}
							{collisions.userRepos[user.id + ":" + repo.repoId] && (
								<Icon name="alert" className="conflict" />
							)}
						</div>
					</Tooltip>
				</li>
			);
		});
	}

	toggleInvisible = async () => {
		const { setUserStatus, currentUserInvisible } = this.props;
		this.setState({ loadingStatus: true });
		await setUserStatus("", "", !currentUserInvisible, 0);
		await this.getScmInfoSummary();
		this.setState({ loadingStatus: false });
	};

	changeTeamName = () =>
		this.setState({ changingTeamName: true, newTeamName: this.props.teamName });

	saveTeamName = async () => {
		await HostApi.instance.send(UpdateTeamRequestType, {
			teamId: this.props.teamId,
			name: this.state.newTeamName
		});

		this.setState({ changingTeamName: false });
	};

	deleteTeam = () => {
		confirmPopup({
			title: "Delete Team",
			message:
				"Team deletion is handled by customer service. Please send an email to support@codestream.com.",
			centered: true,
			buttons: [{ label: "OK", className: "control-button" }]
		});
	};

	changeXray = async value => {
		await HostApi.instance.send(UpdateTeamSettingsRequestType, {
			teamId: this.props.teamId,
			settings: { xray: value }
		});
	};

	removeSuggestion = async user => {
		await HostApi.instance.send(UpdateTeamSettingsRequestType, {
			teamId: this.props.teamId,
			// we need to replace . with * to allow for the creation of deeply-nested
			// team settings, since that's how they're stored in mongo
			settings: { dontSuggestInvitees: { [user.email.replace(".", "*")]: true } }
		});
		this.getSuggestedInvitees();
	};

	onBlameMapEmailChange = event => {
		this.setState({ blameMapEmail: event.target.value });
	};

	onBlameMapEmailBlur = () => {
		if (!this.state.blameMapEmail) {
			this.setState({ addingBlameMap: false });
		}
	};

	onBlameMapUserChange = (email: string, person?: CSUser) => {
		if (person) this.addBlameMap(email, person.id);
		else this.addBlameMap(email, "");
	};

	addBlameMap = async (author: string, assigneeId: string) => {
		await HostApi.instance.send(UpdateTeamSettingsRequestType, {
			teamId: this.props.teamId,
			// we need to replace . with * to allow for the creation of deeply-nested
			// team settings, since that's how they're stored in mongo
			settings: { blameMap: { [author.replace(".", "*")]: assigneeId } }
		});
		this.setState({ blameMapEmail: "", addingBlameMap: false });
	};

	render() {
		const { currentUserId, currentUserInvisible, xraySetting, blameMap } = this.props;
		const { invitingEmails, loadingStatus, addingBlameMap } = this.state;
		const inactive =
			this.props.activePanel !== WebviewPanels.Invite &&
			this.props.activePanel !== WebviewPanels.People;

		const suggested = this.state.suggested.filter(u => !invitingEmails[u.email]);
		// @ts-ignore
		const mappedBlame = keyFilter(blameMap);
		const title = this.state.changingTeamName ? (
			<input
				className="input-text control"
				type="text"
				name="team-name"
				autoFocus
				value={this.state.newTeamName}
				onChange={e => this.setState({ newTeamName: e.target.value })}
				onBlur={this.saveTeamName}
				onKeyPress={e => {
					if (e.key == "Enter") this.saveTeamName();
				}}
			></input>
		) : this.props.isCurrentUserAdmin ? (
			<>
				<DropdownButton
					variant="text"
					items={[
						{
							label: <span style={{ fontSize: "smaller" }}>This menu is admin-only</span>,
							noHover: true,
							disabled: true
						},
						{ label: "-" },
						{
							label: "Live View Settings",
							key: "live-view-settings",
							submenu: [
								{
									label: "Always On",
									checked: xraySetting === "on",
									action: () => this.changeXray("on")
								},
								{
									label: "Always Off",
									checked: xraySetting === "off",
									action: () => this.changeXray("off")
								},
								{
									label: "User Selectable",
									checked: !xraySetting || xraySetting === "user",
									action: () => this.changeXray("user")
								},
								{ label: "-", action: () => {} },
								{
									label: "What is Live View?",
									action: () => {
										HostApi.instance.send(OpenUrlRequestType, {
											url: "https://docs.codestream.com/userguide/features/team-live-view/"
										});
									}
								}
							]
						},
						{
							label: "Code Review Settings...",
							key: "review-settings",
							action: () => this.props.openPanel(WebviewPanels.ReviewSettings),
							disabled: !this.props.multipleReviewersApprove
						},
						{ label: "-", action: () => {} },
						{ label: "Change Team Name", action: this.changeTeamName },
						{ label: "-", action: () => {} },
						{ label: "Delete Team", action: this.deleteTeam }
					]}
				>
					{this.props.teamName}
				</DropdownButton>
			</>
		) : (
			this.props.teamName
		);
		return (
			<div className="panel full-height team-panel">
				<CreateCodemarkIcons />
				<PanelHeader title={title} />
				<ScrollBox>
					<div className="vscroll">
						<div className="section">
							<UL>
								{this.props.members.map(user => (
									<>
										<li key={user.email} style={{ marginTop: "5px" }}>
											{this.renderAdminUser(user)}
											<ProfileLink id={user.id}>
												<Headshot person={user} />
												<b>{user.fullName}</b>{" "}
												<CSText as="span" muted>
													@{user.username}{" "}
												</CSText>
											</ProfileLink>
											&nbsp;
											{(!xraySetting || xraySetting === "user") && user.id === currentUserId && (
												<Icon
													name="broadcast"
													className={cx("clickable spinnable nogrow", {
														no: currentUserInvisible && !loadingStatus,
														info: !currentUserInvisible
													})}
													onClick={this.toggleInvisible}
													placement="bottom"
													loading={loadingStatus}
													title={
														currentUserInvisible
															? "Live View: off (not sharing local changes with teammates)"
															: "Live View: on (sharing local changes with teammates)"
													}
												/>
											)}
										</li>
										{/*<UserStatus user={user} />*/}
										{this.renderModifiedRepos(user)}
									</>
								))}
							</UL>
						</div>
						<div className="section">
							<PanelHeader title="Invite a Teammate">
								<form className="standard-form" onSubmit={this.onSubmit} style={{ padding: 0 }}>
									{this.renderFieldset(inactive)}
								</form>
							</PanelHeader>
						</div>
						{this.props.invited.length > 0 && (
							<div className="section">
								<HR />
								<PanelHeader title="Outstanding Invitations" />
								{!this.props.emailSupported && (
									<div className="color-warning" style={{ padding: "0 20px 10px 20px" }}>
										NOTE: Outgoing email is currently not configured. To invite a teammate, click
										"email" or copy the invite code.
									</div>
								)}
								<UL>
									{this.props.invited.map(user => {
										const body = encodeURIComponent(
											`1. Download and install CodeStream: https://www.codestream.com/roadmap\n\n2. Click “Join an existing team" and paste in your invitation code: ${user.inviteCode}\n\n`
										);
										const subject = "Invitation to CodeStream";
										const title = user.inviteCode ? (
											this.props.emailSupported ? (
												<div>
													Sometimes emails from CodeStream are blocked.
													<div style={{ height: "10px" }}></div>
													<a href={`mailto:${user.email}?Subject=${subject}&body=${body}`}>
														Click Here
													</a>{" "}
													to email an invitation from you.
													<div style={{ height: "10px" }}></div>
													Or share the invite code for {user.email}:
													<br />
													{user.inviteCode}
												</div>
											) : (
												undefined
											)
										) : (
											undefined
										);
										return (
											<li key={user.email}>
												<div className="committer-email">
													{user.email}
													{this.props.isCurrentUserAdmin && (
														<div className="float-right">
															<a onClick={e => this.kick(user)} className="float-right">
																remove
															</a>
															<span className="float-right" style={{ padding: "0 5px" }}>
																&middot;
															</span>
														</div>
													)}
													{!this.props.emailSupported && (
														<div className="float-right">
															<a onClick={e => copy(user.inviteCode)} className="float-right">
																copy code
															</a>
															<span className="float-right" style={{ padding: "0 5px" }}>
																&middot;
															</span>
														</div>
													)}
													{this.props.emailSupported ? (
														<Tooltip
															title={title}
															placement="topRight"
															align={{ offset: [35, -5] }}
														>
															{this.renderEmailUser(user)}
														</Tooltip>
													) : (
														<a
															className="float-right"
															href={`mailto:${user.email}?Subject=${subject}&body=${body}`}
														>
															email
														</a>
													)}
												</div>
												{!this.props.emailSupported && (
													<div>
														<CSText as="span" muted>
															{user.inviteCode}
														</CSText>
													</div>
												)}
											</li>
										);
									})}
								</UL>
							</div>
						)}
						{suggested.length > 0 && (
							<div className="section">
								<HR />
								<PanelHeader
									title={
										<span>
											Suggested Teammates{" "}
											<i style={{ opacity: 0.5, fontSize: "smaller" }}> from your git history</i>
										</span>
									}
								></PanelHeader>
								<UL>
									{suggested.map(user => (
										<li key={user.email}>
											<div className="committer-email">
												{user.fullName}{" "}
												<CSText as="span" muted>
													{user.email}
												</CSText>
												<a onClick={e => this.removeSuggestion(user)} className="float-right">
													remove
												</a>
												<span className="float-right" style={{ padding: "0 5px" }}>
													&middot;
												</span>
												{this.renderEmailUser(user, "invite")}
											</div>
										</li>
									))}
								</UL>
							</div>
						)}
						{(suggested.length > 0 || mappedBlame.length > 0) && (
							<div className="section">
								<HR />
								<PanelHeader
									title={
										<span>
											Blame Map{" "}
											<i style={{ opacity: 0.5, fontSize: "smaller" }}>
												{" "}
												reassign code responsibility
											</i>
										</span>
									}
								></PanelHeader>
								<MapRow>
									<div>
										<b>Code Authored By</b>
									</div>
									<div>
										<b>Now Handled By</b>
									</div>
								</MapRow>
								{mappedBlame.map(email => (
									<MapRow>
										<div>{email.replace("*", ".")}</div>
										<div>
											<SelectPeople
												title="Handled By"
												multiSelect={false}
												value={[]}
												extraItems={[
													{ label: "-" },
													{
														icon: <Icon name="trash" />,
														label: "Delete Mapping",
														key: "remove",
														action: () => this.onBlameMapUserChange(email)
													}
												]}
												onChange={person => this.onBlameMapUserChange(email, person)}
											>
												<HeadshotName
													id={blameMap[email]}
													onClick={() => {} /* noop onclick to get cursor pointer */}
												/>
												<Icon name="chevron-down" />
											</SelectPeople>
										</div>
									</MapRow>
								))}
								{mappedBlame.length === 0 && !addingBlameMap && (
									<MapRow>
										<div>
											<i style={{ opacity: 0.5 }}>example@acme.com</i>
										</div>
										<div>
											<i style={{ opacity: 0.5 }}>newhire@acme.com</i>
										</div>
									</MapRow>
								)}

								{this.props.isCurrentUserAdmin && !addingBlameMap && (
									<MapRow>
										<div>
											<a onClick={() => this.setState({ addingBlameMap: true })}>Add mapping</a>
										</div>
									</MapRow>
								)}
								{addingBlameMap && (
									<MapRow>
										<div>
											<input
												style={{ width: "100%" }}
												className="input-text"
												id="blame-map-email"
												type="text"
												value={this.state.blameMapEmail}
												onChange={this.onBlameMapEmailChange}
												onBlur={this.onBlameMapEmailBlur}
												placeholder="Email..."
												autoFocus={true}
											/>
										</div>
										<div>
											{EMAIL_REGEX.test(this.state.blameMapEmail) && (
												<SelectPeople
													title="Handled By"
													multiSelect={false}
													value={[]}
													onChange={person =>
														this.onBlameMapUserChange(this.state.blameMapEmail, person)
													}
												>
													Select Person <Icon name="chevron-down" />
												</SelectPeople>
											)}
										</div>
									</MapRow>
								)}
							</div>
						)}
						<br />
						<br />
					</div>
				</ScrollBox>
			</div>
		);
	}
}

const mapStateToProps = state => {
	const { users, context, teams, repos, session } = state;
	const team = teams[context.currentTeamId];
	const teamProvider = getTeamProvider(team);

	const memberIds = _difference(team.memberIds, team.removedMemberIds || []);
	const teammates = mapFilter(memberIds, id => {
		const user = users[id as string];
		if (!user || !user.isRegistered || user.deactivated || user.externalUserId) return;

		if (!user.fullName) {
			let email = user.email;
			if (email) user.fullName = email.replace(/@.*/, "");
		}

		// filter out the current user, as we'll render them first
		if (id === session.userId) return;

		return user;
	});
	const currentUser = users[session.userId];
	const invisible = currentUser.status ? currentUser.status.invisible : false;

	const adminIds = team.adminIds;
	const isCurrentUserAdmin = adminIds.includes(session.userId);

	const invited =
		teamProvider === "codestream"
			? mapFilter(memberIds, id => {
					const user = users[id as string];
					if (!user || user.isRegistered || user.deactivated || user.externalUserId) return;
					let email = user.email;
					if (email) user.fullName = email.replace(/@.*/, "");
					return user;
			  })
			: [];

	const xraySetting = team.settings ? team.settings.xray : "";
	const xrayEnabled = xraySetting !== "off";
	const collisions = getCodeCollisions(state);

	const reviewApproval = team.settings ? team.settings.reviewApproval : "user";
	const blameMap = team.settings ? team.settings.blameMap : {};

	const dontSuggestInvitees = team.settings ? team.settings.dontSuggestInvitees || {} : {};
	const multipleReviewersApprove = isFeatureEnabled(state, "multipleReviewersApprove");
	const emailSupported = isFeatureEnabled(state, "emailSupport");

	return {
		teamId: team.id,
		teamName: team.name,
		xraySetting,
		reviewApproval,
		blameMap: blameMap || {},
		adminIds,
		isCurrentUserAdmin,
		dontSuggestInvitees,
		repos,
		collisions,
		currentUserId: currentUser.id,
		currentUserInvisible: invisible,
		currentUserEmail: currentUser.email,
		members: [currentUser, ..._sortBy(teammates, m => (m.fullName || "").toLowerCase())],
		invited: _sortBy(invited, "email"),
		webviewFocused: context.hasFocus,
		xrayEnabled,
		multipleReviewersApprove,
		emailSupported
	};
};

const ConnectedTeamPanel = connect(mapStateToProps, {
	invite,
	updateModifiedRepos,
	clearModifiedFiles,
	setUserStatus,
	openPanel
})(TeamPanel);

export { ConnectedTeamPanel as TeamPanel };
