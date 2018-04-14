import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
//import Button from "./Button";
//import UnexpectedErrorMessage from "./UnexpectedErrorMessage";
import * as actions from "../../actions/onboarding";
import { logout } from "../../actions/context";

export class GetInvitedForm extends Component {
	getFromWhat() {
		if (this.props.knownService) {
			return `"${this.props.org}" ${this.props.knownService} account`;
		} else {
			return `"${this.props.domain}" domain`;
		}
	}

	getContactMessage() {
		if (this.props.teamsMatchingRepo.length === 1) {
			const team = this.props.teamsMatchingRepo[0];
			const teamName = team.name;
			const creator = this.props.teamCreatorsMatchingRepo[team._id];
			const creatorName =
				creator && creator.firstName && creator.lastName
					? `${creator.firstName} ${creator.lastName}`
					: "the admin of that team";
			return (
				<span>
					<FormattedMessage
						id="getInvited.contact.oneTeam"
						defaultMessage={`If this repo should be connected to the ${teamName} team as well, contact ${creatorName} to get invited.`}
					/>
				</span>
			);
		} else {
			const teams = this.props.teamsMatchingRepo
				.map(team => {
					const teamName = team.name;
					const creator = this.props.teamCreatorsMatchingRepo[team._id];
					if (creator && creator.firstName && creator.lastName) {
						const creatorName = `${creator.firstName} ${creator.lastName}`;
						return `${teamName} (${creatorName})`;
					} else {
						return teamName;
					}
				})
				.join(", ");
			return (
				<span>
					<FormattedMessage
						id="getInvited.contact.multipleTeams"
						defaultMessage={`If this repo should be connected to one of the following teams, please ask to be invited: ${teams}.`}
					/>
				</span>
			);
		}
	}

	getCreateSelectTeamMessage() {
		if (this.props.alreadyOnTeam) {
			return (
				<FormattedMessage
					id="getInvited.selectTeam"
					defaultMessage="I don't want to join that team."
				/>
			);
		} else {
			return (
				<FormattedMessage id="getInvited.createTeam" defaultMessage="I want to create a team." />
			);
		}
	}

	render() {
		const fromWhat = this.getFromWhat();
		const contactMessage = this.getContactMessage();
		const createSelectTeamMessage = this.getCreateSelectTeamMessage();
		return (
			<div id="get-invited">
				<h2>
					<FormattedMessage id="getInvited.header" defaultMessage="Get Invited?" />
				</h2>
				<p>
					<FormattedMessage
						id="getInvited.text"
						defaultMessage={`Looks like there are already repos from the ${fromWhat} connected to CodeStream. `}
					/>
					{contactMessage}
				</p>
				<br />
				<p>
					<a onClick={this.props.afterInvite}>
						<FormattedMessage
							id="getInvited.afterInvite"
							defaultMessage="Got my invitation. Let's go!"
						/>
					</a>
				</p>
				<br />
				<p>
					<FormattedMessage id="getInvited.or" defaultMessage="or" />
				</p>
				<br />
				<p>
					<a onClick={this.props.afterInvite}>{createSelectTeamMessage}</a>
				</p>
			</div>
		);
	}
}

const mapStateToProps = ({ onboarding }) => {
	return onboarding;
};

export default connect(mapStateToProps, actions)(GetInvitedForm);
