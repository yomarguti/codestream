import * as React from "react";
import { connect } from "react-redux";
import { openUrl } from "./actions";

interface Props {
	useHref?: boolean;
	href?: string;
	onClick?(event: React.SyntheticEvent): any;
}

function Link(props) {
	let href;
	let onClick;
	if (props.useHref) {
		href = props.href;
	} else {
		onClick =
			props.onClick ||
			function(event: React.SyntheticEvent) {
				event.preventDefault();
				props.openUrl(props.href);
			};
	}

	return <a {...{ href, onClick }}>{props.children}</a>;
}

const mapStateToProps = (state, props: Props) => ({
	useHref: props.href && state.capabilities.openLink
});
const Component = connect(
	mapStateToProps,
	{ openUrl }
)(Link);

export { Component as Link };
