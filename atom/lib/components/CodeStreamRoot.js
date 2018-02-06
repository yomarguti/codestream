import React, { Component } from "react";
import PropTypes from "prop-types";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import Raven from "raven-js";
import NoGit from "./NoGit";
import TooMuchGit from "./TooMuchGit";
import Onboarding from "./onboarding/Onboarding";
import Stream from "./Stream";
import NoAccess from "./NoAccess";

const Loading = props => (
	<div className="loading-page">
		<span className="loading loading-spinner-large inline-block" />
		<p>{props.message}</p>
	</div>
);

const OfflineBanner = connect(state => state.connectivity)(props => (
	<atom-panel id="offline-banner" class={`padded ${props.offline ? "" : "hidden"}`}>
		<div className="content">
			<p>
				<FormattedMessage
					id="OfflineBanner.main"
					defaultMessage="You appear to be offline. We’ll try to reconnect you automatically, or you can "
				/>
				<a>
					<FormattedMessage id="OfflineBanner.tryAgain" defaultMessage="try again now" />
				</a>
				.
			</p>
		</div>
	</atom-panel>
));

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
		const {
			catchingUp,
			accessToken,
			bootstrapped,
			repositories,
			onboarding,
			noAccess
		} = this.props;

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
		if (!bootstrapped) return <Loading message="CodeStream engage..." />;
		if (catchingUp) return <Loading message="Hold on, we're catching you up" />;
		else if (onboarding.complete && accessToken)
			return [<OfflineBanner key="offline-banner" />, <Stream key="stream" />];
		else return [<OfflineBanner key="offline-banner" />, <Onboarding key="onboarding" />];
	}
}

const mapStateToProps = ({ bootstrapped, session, onboarding, context, messaging }) => ({
	accessToken: session.accessToken,
	noAccess: context.noAccess,
	catchingUp: messaging.catchingUp,
	bootstrapped,
	onboarding
});
export default connect(mapStateToProps)(CodeStreamRoot);
