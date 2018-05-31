import "resize-observer";
import React, { Component } from "react";
import { connect } from "react-redux";
import { Stream } from "codestream-components";

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
		// Raven.captureException(error, { extra: info });
	}

	render() {
		const { bootstrapped } = this.props;

		if (this.state.hasError)
			return (
				<div id="oops">
					<p>An unexpected error has occurred. Please reload the window.</p>
				</div>
			);
		if (!bootstrapped) return <Loading message="CodeStream engage..." />;
		else return <Stream />;
	}
}

const mapStateToProps = ({ bootstrapped }) => ({
	bootstrapped
});
export default connect(mapStateToProps)(CodeStreamRoot);
