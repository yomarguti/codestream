import { shell } from "electron";
import React, { Component } from "react";
import { connect } from "react-redux";
import Raven from "raven-js";
import Onboarding from "./onboarding/Onboarding";
import { Stream } from "codestream-components";
import NoAccess from "./NoAccess";
import OfflineBanner from "./OfflineBanner";
import SlackInfo from "./SlackInfo";
import withConfigs from "./withConfigs";
import BufferReferenceManager from "./atom/BufferReferenceManager";

const Loading = props => (
	<div className="loading-page">
		<span className="loading loading-spinner-large inline-block" />
		<p>{props.message}</p>
	</div>
);

class CodeStreamRoot extends Component {
	state = { hasError: false };

	componentDidCatch(error, info) {
		this.setState({ hasError: true });
		Raven.captureException(error, { extra: info });
	}

	render() {
		const {
			catchingUp,
			accessToken,
			bootstrapped,
			onboarding,
			noAccess,
			showSlackInfo
		} = this.props;

		if (this.state.hasError)
			return (
				<div id="oops">
					<p>{"An unexpected error has occurred and we've been notified."}</p>
					<p>
						Please run the `Codestream: Logout` command from the command palette and{" "}
						<a onClick={atom.reload.bind(atom)}>reload</a> atom.
					</p>
					<p>
						Sorry for the inconvenience. If the problem persists, please{" "}
						<a onClick={() => shell.openExternal("https://help.codestream.com")}>contact support</a>.
					</p>
				</div>
			);
		if (noAccess) return <NoAccess reason={noAccess} />;
		if (!bootstrapped) return <Loading message="CodeStream engage..." />;
		if (catchingUp) return <Loading message="Hold on, we're catching you up" />;
		if (showSlackInfo) return <SlackInfo />;
		else if (onboarding.complete && accessToken) {
			return [
				<OfflineBanner key="offline-banner" />,
				<BufferReferenceManager
					key="buffer-references"
					workingDirectory={this.props.workingDirectory}
					repo={atom.project.repositories[0]}
				/>,
				<Stream key="stream" />
			];
		} else return [<OfflineBanner key="offline-banner" />, <Onboarding key="onboarding" />];
	}
}

const mapStateToProps = ({
	bootstrapped,
	session,
	onboarding,
	context,
	messaging,
	repoAttributes
}) => ({
	accessToken: session.accessToken,
	noAccess: context.noAccess,
	catchingUp: messaging.catchingUp,
	showSlackInfo: context.showSlackInfo,
	workingDirectory: repoAttributes.workingDirectory,
	bootstrapped,
	onboarding
});
export default connect(mapStateToProps)(withConfigs(CodeStreamRoot));
