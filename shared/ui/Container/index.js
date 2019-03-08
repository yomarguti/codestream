import React from "react";
import PropTypes from "prop-types";
import { addLocaleData, IntlProvider } from "react-intl";
import englishLocaleData from "react-intl/locale-data/en";
import { connect, Provider } from "react-redux";
import Stream from "../Stream/index";
import Login from "../Login";
import Signup from "../Signup";
import CompleteSignup from "../CompleteSignup";
import { SlackInfo } from "../SlackInfo";
import { logError } from "../logger";
import { HostApi } from "../webview-api";
import { ReloadWebviewRequestType } from "../ipc/webview.protocol";

addLocaleData(englishLocaleData);

const Loading = props => (
	<div className="loading-page">
		<span className="loading loading-spinner-large inline-block" />
		<p>{props.message}</p>
	</div>
);

const UnauthenticatedRoutes = connect(state => state.route)(props => {
	switch (props.route) {
		case "signup":
			return <Signup />;
		case "login":
			return <Login />;
		case "completeSignup":
			return <CompleteSignup {...props.params} />;
		case "slackInfo":
			return <SlackInfo />;
		default:
			return <Login />;
	}
});

const mapStateToProps = state => ({
	bootstrapped: state.bootstrapped,
	loggedIn: Boolean(state.session.userId)
});
const Root = connect(mapStateToProps)(props => {
	if (!props.bootstrapped) return <Loading message="CodeStream engage..." />;
	if (!props.loggedIn) return <UnauthenticatedRoutes />;
	return <Stream />;
});

export default class Container extends React.Component {
	state = { hasError: false };

	static getDerivedStateFromError(error) {
		return { hasError: true };
	}

	static childContextTypes = {
		store: PropTypes.object
	};

	getChildContext() {
		return { store: this.props.store };
	}

	componentDidCatch(error, info) {
		logError(`Exception caught in React component tree: ${error.message}`, {
			stacktrace: error.stack,
			info
		});
	}

	handleClickReload = event => {
		event.preventDefault();
		HostApi.instance.send(ReloadWebviewRequestType);
	};

	render() {
		const { i18n, store } = this.props;

		if (this.state.hasError) {
			document.body.classList.remove("loading");
		}

		let content;
		if (this.state.hasError)
			content = (
				<div id="oops">
					<p>
						An unexpected error has occurred. <a onClick={this.handleClickReload}>Click here</a> to
						reload this tab.
					</p>
				</div>
			);
		else content = <Root />;

		return (
			<IntlProvider locale={i18n.locale} messages={i18n.messages}>
				<Provider store={store}>{content}</Provider>
			</IntlProvider>
		);
	}
}
