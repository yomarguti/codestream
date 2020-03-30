import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import Icon from "./Icon";
import Button from "./Button";
import Headshot from "./Headshot";
import ScrollBox from "./ScrollBox";
import { invite } from "./actions";
import { mapFilter } from "../utils";
import { sortBy as _sortBy } from "lodash-es";
import { getTeamProvider } from "../store/teams/reducer";
import { HostApi } from "../webview-api";
import { WebviewPanels } from "@codestream/protocols/webview";
import { PanelHeader } from "../src/components/PanelHeader";
import { setUserStatus } from "./actions";
import {
	RepoScmStatus,
	DidChangeDataNotificationType,
	ChangeDataType
} from "@codestream/protocols/agent";
import { CSUser } from "@codestream/protocols/api";
import { ChangesetFile } from "./Review/ChangesetFile";
import Tooltip from "./Tooltip";
import { UserStatus } from "../src/components/UserStatus";
import { DocumentData } from "../protocols/agent/agent.protocol.notifications";
import { updateModifiedRepos, clearModifiedFiles } from "../store/users/actions";
import { CSText } from "../src/components/CSText";
import { isFeatureEnabled } from "../store/apiVersioning/reducer";
import cx from "classnames";

const EMAIL_REGEX = new RegExp(
	"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
);

interface Props extends ConnectedProps {}

interface ConnectedProps {
	isCodeStreamTeam: boolean;
	webviewFocused: boolean;
	teamId: string;
	activePanel: WebviewPanels;
	invite: Function;
	invited: any[];
	suggested: any[];
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
	xrayEnabled: boolean;
	setUserStatus: Function;
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
		loadingStatus: false
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

		if (this.props.currentUserInvisible) this.clearScmInfoSummary();
		else this.getScmInfoSummary();

		this.startPolling();
	}

	componentWillUnmount() {
		this._mounted = false;
		this.disposables.forEach(d => d.dispose());
		this.stopPolling();
	}

	private startPolling() {
		// poll to get any changes that might happen outside the scope of
		// the documentManager operations
		if (!this._mounted || this._pollingTimer !== undefined) return;

		this._pollingTimer = setInterval(() => {
			this.getScmInfoSummary();
		}, 30000);
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
				this.setState(this.initialState);
			});
	};

	onClickReinvite = user => {
		const { email } = user;
		this.setState({ invitingEmails: { ...this.state.invitingEmails, [email]: 1 } });
		this.props.invite({ email: user.email, teamId: this.props.teamId }).then(() => {
			// TODO: show notification
			// atom.notifications.addInfo(
			// 	this.props.intl.formatMessage({
			// 		id: "invitation.emailSent",
			// 		defaultMessage: `Invitation sent to ${user.email}!`
			// 	})
			// );
			this.setState({ invitingEmails: { ...this.state.invitingEmails, [email]: 2 } });
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
			HostApi.instance.track("Paywall Hit", {
				"Pay Wall": "Team Size"
			});
			return this.renderInviteDisabled();
		}

		if (!this.props.isCodeStreamTeam) return this.renderThirdParyInvite(this.props.teamProvider);

		if (false) {
			return (
				<div style={{ padding: "0 0 20px 15px" }}>
					<Button className="standard" onClick={e => this.setState({ isInviting: true })}>
						Invite Teammates
					</Button>
				</div>
			);
		}
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
								autoFocus
							/>
							{this.renderEmailHelp()}
						</div>
						<Button
							style={{ width: "60px", margin: "0 0 6px 10px" }}
							id="add-button"
							className="control-button"
							type="submit"
							loading={this.state.loading}
						>
							<FormattedMessage id="teamMemberSelection.invite" defaultMessage="Invite" />
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
					<span className="reinvite">
						<Icon className="spin" name="sync" />
					</span>
				);
			case 2:
				return <span className="reinvite">email sent</span>;
			default:
				return (
					<a
						className="reinvite"
						onClick={event => {
							event.preventDefault();
							this.onClickReinvite(user);
						}}
					>
						{linkText}
					</a>
				);
		}
	}

	renderModifiedRepos(user) {
		const { repos, teamId, currentUserEmail } = this.props;
		const { modifiedRepos } = user;

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
				<>
					<div className="related-label">Local Changes</div>
					{modifiedFiles.map(f => (
						<ChangesetFile noHover={true} key={f.file} {...f} />
					))}
					{stomp && (
						<div style={{ paddingTop: "10px" }}>
							<span className="stomped" style={{ paddingLeft: 0 }}>
								@{stomp.stomped}
							</span>{" "}
							= includes {stomp.stomped} change
							{stomp.stomped > 1 ? "s" : ""} to code you wrote
						</div>
					)}
				</>
			);
			return (
				<li
					className="status row-with-icon-actions"
					style={{ overflow: "hidden", whiteSpace: "nowrap", paddingLeft: "48px" }}
				>
					<Tooltip title={title} placement="topRight">
						<div style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
							<Icon name="repo" /> {repoName} &nbsp; <Icon name="git-branch" /> {repo.branch}
							{added > 0 && <span className="added">+{added}</span>}
							{removed > 0 && <span className="deleted">-{removed}</span>}
							{stomp && <span className="stomped">@{stomp.stomped}</span>}
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

	render() {
		const { xrayEnabled, currentUserId, currentUserInvisible } = this.props;
		const { invitingEmails, loadingStatus } = this.state;
		const inactive =
			this.props.activePanel !== WebviewPanels.Invite &&
			this.props.activePanel !== WebviewPanels.People;

		const suggested = this.props.suggested.filter(u => !invitingEmails[u.email]);
		return (
			<div className="panel full-height invite-panel">
				<PanelHeader title={this.props.teamName} />
				<ScrollBox>
					<div className="vscroll">
						<div className="section">
							<ul>
								{this.props.members.map(user => (
									<>
										<li key={user.email} style={{ marginTop: "5px" }}>
											<Headshot person={user}></Headshot>
											<b>{user.fullName}</b>{" "}
											<CSText as="span" muted>
												@{user.username}{" "}
											</CSText>
											&nbsp;
											{xrayEnabled && user.id === currentUserId && (
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
															? "Not sharing local changes with the team"
															: "Sharing local changes with the team"
													}
												/>
											)}
										</li>
										{/*<UserStatus user={user} />*/}
										{this.renderModifiedRepos(user)}
									</>
								))}
							</ul>
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
								<PanelHeader title="Outstanding Invitations" />
								<ul>
									{this.props.invited.map(user => (
										<li key={user.email}>
											<div className="committer-email">
												{user.email}
												{this.renderEmailUser(user)}
											</div>
										</li>
									))}
								</ul>
							</div>
						)}
						{suggested.length > 0 && (
							<div className="section">
								<PanelHeader title="Suggested Invitations">
									<i style={{ opacity: 0.5 }}>From git history</i>
								</PanelHeader>
								<ul>
									{suggested.map(user => (
										<li key={user.email}>
											<div className="committer-email">
												{user.fullName} {user.email}
												{this.renderEmailUser(user, "invite")}
											</div>
										</li>
									))}
								</ul>
							</div>
						)}
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

	const teammates = mapFilter(team.memberIds, id => {
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

	const invited =
		teamProvider === "codestream"
			? mapFilter(team.memberIds, id => {
					const user = users[id as string];
					if (!user || user.isRegistered || user.deactivated || user.externalUserId) return;
					let email = user.email;
					if (email) user.fullName = email.replace(/@.*/, "");
					return user;
			  })
			: [];

	// this should be populated by something like
	// git log --pretty=format:"%an|%aE" | sort -u
	// and then filter out noreply.github.com (what else?)
	const suggested = [] as any; //[{ fullName: "Fred", email: "pez+555t@codestream.com" }];

	return {
		teamId: team.id,
		teamName: team.name,
		repos,
		currentUserId: currentUser.id,
		currentUserInvisible: invisible,
		currentUserEmail: currentUser.email,
		members: [currentUser, ..._sortBy(teammates, m => (m.fullName || "").toLowerCase())],
		invited: _sortBy(invited, "email"),
		suggested: _sortBy(suggested, m => (m.fullName || "").toLowerCase()),
		webviewFocused: context.hasFocus,
		xrayEnabled: isFeatureEnabled(state, "xray")
	};
};

const ConnectedTeamPanel = connect(mapStateToProps, {
	invite,
	updateModifiedRepos,
	clearModifiedFiles,
	setUserStatus
})(TeamPanel);

export { ConnectedTeamPanel as TeamPanel };
