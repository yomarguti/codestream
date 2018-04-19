import PropTypes from "prop-types";
import React from "react";
import { FormattedMessage } from "react-intl";

const UnexpectedErrorMessage = (props, context) => (
	<span className={props.classes}>
		<FormattedMessage
			id="error.unexpected"
			defaultMessage="Something went wrong! Please try again, or "
		/>
		<a onClick={() => context.platform.openInBrowser("https://help.codestream.com")}>
			<FormattedMessage id="contactSupport" defaultMessage="contact support" />
		</a>
		.
	</span>
);

UnexpectedErrorMessage.contextTypes = {
	platform: PropTypes.object
};

export default UnexpectedErrorMessage;
