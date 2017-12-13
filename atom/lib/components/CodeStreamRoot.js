import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import NoGit from "./NoGit";
import Onboarding from "./onboarding/Onboarding";
import Stream from "./Stream";

const Loading = () => <span className="loading loading-spinner-large inline-block" />;

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
		const { accessToken, bootstrapped, repositories, onboarding } = this.props;

		if (repositories.length === 0) return <NoGit />;
		if (!bootstrapped) return <Loading />;
		else if (onboarding.complete && accessToken) return <Stream />;
		else {
			return <Onboarding />;
		}
	}
}

const mapStateToProps = ({ bootstrapped, session, onboarding }) => ({
	accessToken: session.accessToken,
	bootstrapped,
	onboarding
});
export default connect(mapStateToProps)(CodeStreamRoot);
