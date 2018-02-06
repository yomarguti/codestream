import React, { PureComponent } from "react";
import { connect } from "react-redux";
import { FormattedMessage } from "react-intl";
import { checkServerStatus } from "../actions/connectivity";

class OfflineBanner extends PureComponent {
	componentDidMount() {
		if (this.props.isOffline) this.startPolling();
	}

	componentDidUpdate(oldProps) {
		if (this.props.isOffline) this.startPolling();
		else this.stopPolling();
	}

	componentWillUnmount() {
		this.stopPolling();
	}

	startPolling = () => (this.interval = setInterval(this.props.checkServerStatus, 20000));

	stopPolling() {
		if (this.interval) clearInterval(this.interval);
	}

	render() {
		if (!this.props.isOffline) return false;
		return (
			<atom-panel id="offline-banner" class="padded">
				<div className="content">
					<p>
						<FormattedMessage
							id="OfflineBanner.main"
							defaultMessage="You appear to be offline. We’ll try to reconnect you automatically, or you can "
						/>
						<a onClick={this.props.checkServerStatus}>
							<FormattedMessage id="OfflineBanner.tryAgain" defaultMessage="try again now" />
						</a>
						.
					</p>
				</div>
			</atom-panel>
		);
	}
}

const mapStateToProps = ({ connectivity }) => ({ isOffline: connectivity.offline });
export default connect(mapStateToProps, { checkServerStatus })(OfflineBanner);
