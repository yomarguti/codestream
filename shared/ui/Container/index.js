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

export class Loading extends React.Component {
	static defaultProps = {
		forceAnimation: false,
		renderDelay: 250,
		animationDelay: 1000
	};

	constructor(props) {
		super(props);
		this.state = { showRings: props.forceAnimation, shouldRender: !props.delayRender };
	}

	componentDidMount() {
		const { forceAnimation, animationDelay, delayRender, renderDelay } = this.props;
		if (forceAnimation === false) {
			this.animationDelayId = setTimeout(() => {
				this.setState({ showRings: true });
			}, animationDelay);
		}
		if (delayRender) {
			this.renderDelayId = setTimeout(() => {
				this.setState({ shouldRender: true });
			}, renderDelay);
		}
	}

	componentWillUnmount() {
		this.animationDelayId && clearTimeout(this.animationDelayId);
		this.renderDelayId && clearTimeout(this.renderDelayId);
	}

	render() {
		if (this.state.shouldRender === false) return null;

		return (
			<div id="spinner" style={this.props.style}>
				<div className="loader-ring">
					{this.state.showRings ? (
						<React.Fragment>
							<div className="loader-ring__segment" />
							<div className="loader-ring__segment" />
							<div className="loader-ring__segment" />
							<div className="loader-ring__segment" />
						</React.Fragment>
					) : null}
				</div>
			</div>
		);
	}
}

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
