import { OpenUrlRequestType } from "@codestream/protocols/agent";
import React from "react";
import { connect } from "react-redux";
import { HostApi } from "../webview-api";

interface Props {
	useHref?: boolean;
	href?: string;
	onClick?(event: React.SyntheticEvent): any;
	children: JSX.Element;
}

function Link(props: Props) {
	let href;
	let onClick;
	if (props.useHref) {
		href = props.href;
	} else {
		onClick =
			props.onClick ||
			function(event: React.SyntheticEvent) {
				event.preventDefault();
				HostApi.instance.send(OpenUrlRequestType, { url: props.href! });
			};
	}

	return <a {...{ href, onClick }}>{props.children}</a>;
}

const mapStateToProps = (state, props: Props) => ({
	useHref: props.href && state.capabilities.openLink
});
const Component = connect(mapStateToProps)(Link);

export { Component as Link };
