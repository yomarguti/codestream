import React from "react";
import { FormattedMessage } from "react-intl";

export default ({ reason }) => (
	<div id="no-access">
		<h2>
			<FormattedMessage
				id={reason.noUrl || reason.noGit ? "noGit.header" : "noAccess.header"}
				defaultMessage="Access Problem!"
			/>
		</h2>
		{reason.noUrl && (
			<h5>
				<FormattedMessage
					id="noAccess.noUrl"
					defaultMessage="Make sure you have an origin url configured for this repository."
				/>
			</h5>
		)}
		{reason.noAccess && (
			<h5>
				<FormattedMessage
					id="noAccess.access"
					defaultMessage="It looks like you don't have access to collaborate in this repo on CodeStream."
				/>
			</h5>
		)}
		{reason.noGit && (
			<h5>
				<FormattedMessage
					id="noAccess.git"
					defaultMessage="CodeStream is unable to locate the git command. Please ensure git is in your PATH."
				/>
			</h5>
		)}
		<h5>
			<FormattedMessage id="noAccess.contact" defaultMessage="Please contact us at " />
			<a>support@codestream.com</a>.
		</h5>
	</div>
);
