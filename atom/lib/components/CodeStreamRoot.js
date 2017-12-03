import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import NoGit from "./NoGit";
import Onboarding from "./onboarding/Onboarding";
import Stream from "./Stream";

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
		const { accessToken, repositories, onboarding } = this.props;

		console.log("rendering with", this.props);
		if (repositories.length === 0) return <NoGit />;
		else if (onboarding.complete && accessToken) return <Stream />;
		else {
			return <Onboarding />;
		}
	}
}

const mapStateToProps = ({ session, user, team, onboarding, repos, repoMetadata }) => ({
	accessToken: session.accessToken,
	user,
	team,
	onboarding,
	repos,
	repoMetadata
});
export default connect(mapStateToProps)(CodeStreamRoot);
