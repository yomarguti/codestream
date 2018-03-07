import React from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import Button from "./onboarding/Button";
import { cancelSlackInfo as cancel } from "../actions/context";

export default connect(null, { cancel })(props => (
	<div id="slack-info">
		<h2>
			<FormattedMessage id="slackInfo.header" defaultMessage="Slack Integration" />
		</h2>
		<p>
			<FormattedMessage id="slackInfo.p1" />
		</p>
		<p>
			<FormattedMessage id="slackInfo.p2" />
		</p>
		<Button>Add to Slack</Button>
		<small className="centered">
			<a onClick={e => props.cancel()}>Cancel</a>
		</small>
	</div>
));
