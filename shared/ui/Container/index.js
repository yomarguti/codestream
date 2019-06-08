import React from "react";
import PropTypes from "prop-types";
import { addLocaleData, IntlProvider } from "react-intl";
import englishLocaleData from "react-intl/locale-data/en";
import { connect, Provider } from "react-redux";
import Stream from "../Stream/index";
import { UnauthenticatedRoutes } from "../Authentication";
import { logError } from "../logger";
import { HostApi } from "../webview-api";
import { ReloadWebviewRequestType } from "../ipc/webview.protocol";
import { Loading } from "./Loading";

addLocaleData(englishLocaleData);

const mapStateToProps = state => ({
	bootstrapped: state.bootstrapped,
	loggedIn: Boolean(state.session.userId)
});
const Root = connect(mapStateToProps)(props => {
	if (!props.bootstrapped) return <Loading />;
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
