import React, { PureComponent } from "react";
import { connect } from "react-redux";
import { FormattedMessage } from "react-intl";
// import { checkServerStatus } from "../actions/connectivity";

class OfflineBanner extends PureComponent {
	componentDidMount() {
		if (this.props.isOffline) this.startPolling();
	}

	componentDidUpdate(_oldProps) {
		if (this.props.isOffline) this.startPolling();
		else this.stopPolling();
	}

	componentWillUnmount() {
		this.stopPolling();
	}

	startPolling = () => {
		if (!this.interval) this.interval = setInterval(this.props.checkServerStatus, 20000);
	};

	stopPolling() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	render() {
		if (this.props.isOffline)
			<div id="offline-banner">
				<p>
					<FormattedMessage
						id="offlineBanner.offline.main"
						defaultMessage="You appear to be offline. We’ll try to reconnect you automatically, or you can "
					/>
					<a onClick={this.props.checkServerStatus}>
						<FormattedMessage id="offlineBanner.offline.tryAgain" defaultMessage="try again now" />
					</a>
					.
				</p>
			</div>;
		else return false;
	}
}

const mapStateToProps = ({ connectivity }) => ({
	isOffline: connectivity.offline
});
export default connect(
	mapStateToProps,
	{ checkServerStatus: new Function() }
)(OfflineBanner);
