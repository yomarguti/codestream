import React from "react";
import { FormattedMessage } from "react-intl";

export default () => (
	<div id="no-access">
		<h2>
			<FormattedMessage id="noAccess.header" defaultMessage="Access Problem!" />
		</h2>
		<h5>
			<FormattedMessage
				id="noAccess.message"
				defaultMessage="It looks like you don't have access to collaborate in this repo on CodeStream. Please contact us at "
			/>
			<a>support@codestream.com</a>.
		</h5>
	</div>
);
