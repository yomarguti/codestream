import React, { Component } from "react";
import { Container } from "codestream-components";
import translations from "codestream-components/translations/en.json";

export default class CodeStreamRoot extends Component {
	render() {
		const { store } = this.props;

		// if (this.state.hasError)
		// 	return (
		// 		<div id="oops">
		// 			<p>{"An unexpected error has occurred and we've been notified."}</p>
		// 			<p>
		// 				Please run the `Codestream: Logout` command from the command palette and{" "}
		// 				<a onClick={atom.reload.bind(atom)}>reload</a> atom.
		// 			</p>
		// 			<p>
		// 				Sorry for the inconvenience. If the problem persists, please{" "}
		// 				<a onClick={() => shell.openExternal("https://help.codestream.com")}>contact support</a>.
		// 			</p>
		// 		</div>
		// 	);
		return <Container store={store} i18n={{ locale: "en", messages: translations }} />;
		// if (catchingUp) return <Loading message="Hold on, we're catching you up" />;
		// if (showSlackInfo) return <SlackInfo />;
		// else if (onboarding.complete && accessToken) {
		// 	return [
		// 		<OfflineBanner key="offline-banner" />,
		// 		<BufferReferenceManager
		// 			key="buffer-references"
		// 			workingDirectory={this.props.workingDirectory}
		// 			repo={atom.project.repositories[0]}
		// 		/>,
		// 		<Stream key="stream" />
		// 	];
		// } else return [<OfflineBanner key="offline-banner" />, <Onboarding key="onboarding" />];
	}
}
