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
import {
	GetRepoScmStatusesRequestType,
	RepoScmStatus,
	SetModifiedReposRequestType
} from "@codestream/protocols/agent";
import { CSUser, CSApiCapabilities } from "@codestream/protocols/api";
import { ChangesetFile } from "./Review/ChangesetFile";
import Tooltip from "./Tooltip";
import styled from "styled-components";
import { UserStatus } from "../src/components/UserStatus";

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
	apiCapabilities: CSApiCapabilities;
	currentUserInvisible: false;
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
		modifiedRepos: []
	};

	constructor(props: Props) {
		super(props);
		this.state = this.initialState;
	}

	componentDidMount() {
		if (this.props.webviewFocused)
			HostApi.instance.track("Page Viewed", { "Page Name": "Team Tab" });

		// if (this.props.apiCapabilities["xray"])
		if (this.props.currentUserInvisible) this.clearScmInfoSummary();
		else this.getScmInfoSummary();
	}

	getScmInfoSummary = async () => {
		const result = await HostApi.instance.send(GetRepoScmStatusesRequestType, {});
		if (result.scm) {
			// this.setState({ modifiedRepos: result.scm });
			await HostApi.instance.send(SetModifiedReposRequestType, { modifiedRepos: result.scm });
		}
	};

	clearScmInfoSummary = async () => {
		await HostApi.instance.send(SetModifiedReposRequestType, { modifiedRepos: [] });
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
		const { repos, apiCapabilities } = this.props;
		const { modifiedRepos = [] } = user;

		if (modifiedRepos.length === 0) return null;

		console.log("USER IS: ", user);
		return (
			<>
				{modifiedRepos.map(repo => {
					const { repoId = "", modifiedFiles } = repo;
					if (modifiedFiles.length === 0) return null;
					const repoName = repos[repoId] ? repos[repoId].name : "";
					const added = modifiedFiles.reduce((total, f) => total + f.linesAdded, 0);
					const removed = modifiedFiles.reduce((total, f) => total + f.linesRemoved, 0);
					const title = modifiedFiles.map(f => <ChangesetFile key={f.file} {...f} />);
					return (
						<li className="status row-with-icon-actions" style={{ paddingLeft: "48px" }}>
							<Tooltip title={title} placement="topRight">
								<div>
									<Icon name="repo" /> {repoName} &nbsp; <Icon name="git-branch" /> {repo.branch}
									{added > 0 && <span className="added">+{added}</span>}
									{removed > 0 && <span className="deleted">-{removed}</span>}
								</div>
							</Tooltip>
						</li>
					);
				})}
			</>
		);
	}

	render() {
		const { invitingEmails } = this.state;
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
											<b>{user.fullName}</b> <UserStatus user={user} />
										</li>
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

const mapStateToProps = ({ users, context, teams, repos, session, apiVersioning }) => {
	const team = teams[context.currentTeamId];
	const teamProvider = getTeamProvider(team);

	const members = mapFilter(team.memberIds, id => {
		const user = users[id as string];
		if (!user || !user.isRegistered || user.deactivated || user.externalUserId) return;

		if (!user.fullName) {
			let email = user.email;
			if (email) user.fullName = email.replace(/@.*/, "");
		}
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
		currentUserInvisible: invisible,
		members: _sortBy(members, m => (m.fullName || "").toLowerCase()),
		invited: _sortBy(invited, "email"),
		suggested: _sortBy(suggested, m => (m.fullName || "").toLowerCase()),
		webviewFocused: context.hasFocus,
		apiCapabilities: apiVersioning.apiCapabilities
	};
};

const ConnectedTeamPanel = connect(mapStateToProps, { invite })(TeamPanel);

export { ConnectedTeamPanel as TeamPanel };
