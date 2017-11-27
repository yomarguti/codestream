import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import PropTypes from "prop-types";
import _ from "underscore";
import withAPI from "./withAPI";
import Button from "./Button";
import git from "../git";
import { addMembers } from "../actions/team";

export class SimpleTeamMemberSelectionForm extends Component {
	static contextTypes = {
		repositories: PropTypes.array
	};

	constructor(props) {
		super(props);
		this.state = {
			committers: []
		};
	}

	async componentDidMount() {
		const repository = this.context.repositories[0];
		const recentCommitterData = await git(
			["log", "--format=%an<trim-this>%ae", '--since="1 month ago"'],
			{
				cwd: repository.getWorkingDirectory()
			}
		);
		const recentCommitterString = recentCommitterData.split("\n");
		const recentCommitters = _.uniq(recentCommitterString)
			.filter(Boolean)
			.map(string => {
				const [name, email] = string.split("<trim-this>");
				return { name, email, selected: true };
			});
		const olderCommitterData = await git(
			["log", "--format=%an<trim-this>%ae", '--before="1 month ago"'],
			{
				cwd: repository.getWorkingDirectory()
			}
		);
		const olderCommitterString = olderCommitterData.split("\n");
		const olderCommitters = _.uniq(olderCommitterString)
			.filter(Boolean)
			.map(string => {
				const [name, email] = string.split("<trim-this>");
				return { name, email, selected: false };
			})
			.filter(committer => _.findWhere(recentCommitters, { email: committer.email }));

		this.setState({ committers: [...recentCommitters, ...olderCommitters] });
	}

	onChange = event => {
		const selectedEmail = event.target.value;
		this.setState(state => {
			return {
				committers: state.committers.map(committer => {
					if (committer.email === selectedEmail)
						return { ...committer, selected: !committer.selected };
					else return committer;
				})
			};
		});
	};

	onSubmit = () => {
		this.setState({ loading: true });
		const { addMembers, store, transition } = this.props;
		const { team, repoMetadata } = store.getState();
		const emails = this.state.committers.filter(c => c.selected).map(c => c.email);
		addMembers({
			teamId: team._id,
			url: repoMetadata.url,
			firstCommitHash: repoMetadata.firstCommitHash,
			emails
		})
			.then(() => transition("success"))
			.catch(error => {
				this.setState({ loading: false });
				atom.notifications.addError("there was a problem...");
				console.log(error);
				if (error.data.code === "RAPI-1003") {
					this.setState({ teamNotFound: true });
				}
				if (error.data.code === "RAPI-1011") {
					this.setState({ noPermission: true });
				}
			});
	};

	renderError = () => {};

	render() {
		return (
			<div id="team-member-selection">
				<h2>
					<FormattedMessage id="teamMemberSelection.header" defaultMessage="Who's on the team?" />
				</h2>
				<form onSubmit={this.onSubmit}>
					{this.renderError()}
					<ul>
						{this.state.committers.map(committer => {
							return (
								<li key={committer.email}>
									<div className="block">
										<label className="input-label">
											<div className="input">
												<input
													className="input-checkbox"
													type="checkbox"
													value={committer.email}
													checked={committer.selected}
													onChange={this.onChange}
												/>
											</div>
											<div className="committer-info">
												<div className="committer-name">{committer.name}</div>
												<div>{committer.email}</div>
											</div>
										</label>
									</div>
								</li>
							);
						})}
					</ul>
					<div>
						<p className="help-text">
							<FormattedMessage
								id="teamMemberSelection.anyoneMissing"
								defaultMessage="Anyone missing?"
							/>{" "}
							<a>
								<FormattedMessage id="teamMemberSelection.addThem" defaultMessage="Add them!" />
							</a>
						</p>
					</div>
					<div className="footer">
						<FormattedMessage
							id="teamMemberSelection.footer"
							defaultMessage="Don't worry, we won't send out any invitation emails!"
						/>
					</div>
					<Button id="submit-button" loading={this.state.loading}>
						<FormattedMessage id="teamMemberSelection.submitButton" defaultMessage="GET STARTED" />
					</Button>
				</form>
			</div>
		);
	}
}

export default withAPI({ addMembers })(SimpleTeamMemberSelectionForm);
