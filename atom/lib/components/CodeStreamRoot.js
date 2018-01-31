import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import Raven from "raven-js";
import NoGit from "./NoGit";
import TooMuchGit from "./TooMuchGit";
import Onboarding from "./onboarding/Onboarding";
import Stream from "./Stream";
import NoAccess from "./NoAccess";

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

	componentDidCatch(error, info) {
		this.setState({ hasError: true });
		Raven.captureException(error, { extra: info });
	}

	render() {
		const { accessToken, bootstrapped, repositories, onboarding, noAccess } = this.props;

		if (this.state.hasError)
			return (
				<div>
					<p>
						Oops something went wrong. TODO: make this richer. For now, a reset is probably
						required.
					</p>
				</div>
			);
		if (repositories.length === 0) return <NoGit />;
		if (repositories.length > 1) return <TooMuchGit />;
		if (noAccess) return <NoAccess reason={noAccess} />;
		if (!bootstrapped) return <Loading />;
		else if (onboarding.complete && accessToken) return <Stream />;
		else {
			return <Onboarding />;
		}
	}
}

const mapStateToProps = ({ bootstrapped, session, onboarding, context }) => ({
	accessToken: session.accessToken,
	noAccess: context.noAccess,
	bootstrapped,
	onboarding
});
export default connect(mapStateToProps)(CodeStreamRoot);
