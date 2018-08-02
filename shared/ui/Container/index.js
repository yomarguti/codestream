import * as React from "react";
import { addLocaleData, IntlProvider } from "react-intl";
import englishLocaleData from "react-intl/locale-data/en";
import { connect, Provider } from "react-redux";
import Stream from "../Stream";
import Login from "../Login";
import CompleteSignup from "../CompleteSignup";

addLocaleData(englishLocaleData);

const UnauthenticatedRoutes = connect(state => ({ page: state.route }))(props => {
	switch (props.page) {
		case "login":
			return <Login />;
		case "completeSignup":
			return <CompleteSignup />;
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

	componentDidCatch(error, info) {
		this.setState({ hasError: true });
	}

	render() {
		const { i18n, store } = this.props;

		let content;
		if (this.state.hasError)
			content = (
				<div id="oops">
					<p>An unexpected error has occurred. Please reload the window.</p>
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
