import React, { Component } from "react";
import getSystemUser from "username";
import PropTypes from "prop-types";
import NoGit from "./NoGit";
import Onboarding from "./onboarding/Onboarding";
import Stream from "./Stream";
import withAPI from "./onboarding/withAPI";

class CodeStreamRoot extends Component {
	static defaultProps = {
		repositories: [],
		user: {}
	};

	static childContextTypes = {
		repositories: PropTypes.array
	};

	constructor(props) {
		super(props);
		this.state = {};
	}

	getChildContext() {
		return {
			repositories: this.props.repositories
		};
	}

	render() {
		const { accessToken, user, repositories, team, onboarding } = this.props;

		console.log("renering in CodeStreamRoot", this.props);

		if (repositories.length === 0) return <NoGit />;
		else if (onboarding.complete && accessToken) return <Stream />;
		else {
			const repository = repositories[0];
			const gitDirectory = repository.getWorkingDirectory();
			const email = repository.getConfigValue("user.email", gitDirectory);
			const name = repository.getConfigValue("user.name", gitDirectory);
			return <Onboarding team={team} email={email} username={getSystemUser.sync()} name={name} />;
		}
	}
}

const mapStateToProps = ({ accessToken, user, team, onboarding }) => ({
	accessToken,
	user,
	team,
	onboarding
});
export default withAPI(mapStateToProps)(CodeStreamRoot);
