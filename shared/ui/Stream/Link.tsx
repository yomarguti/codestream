import { OpenUrlRequestType } from "@codestream/protocols/agent";
import React from "react";
import { connect } from "react-redux";
import { HostApi } from "../webview-api";
import styled from "styled-components";

interface Props {
	useHref?: boolean;
	href?: string;
	onClick?(event: React.SyntheticEvent): any;
	children: React.ReactNode;
	className?: string;
}

const Link = styled(function(props: Props) {
	let href;
	if (props.useHref) {
		href = props.href;
	}

	const onClick =
		props.onClick ||
		function(event: React.SyntheticEvent) {
			if (!(event.target as any).href) {
				event.preventDefault();
				HostApi.instance.send(OpenUrlRequestType, { url: props.href! });
			}
		};

	return <a {...{ href, onClickCapture: onClick, className: props.className }}>{props.children}</a>;
})`
	text-decoration: none !important;
	color: var(--text-color);
	:hover {
		color: var(--text-color-info);
		text-decoration: none !important;
	}
`;

const mapStateToProps = (state, props: Props) => ({
	useHref: props.href && state.capabilities.openLink
});
const Component = connect(mapStateToProps)(Link);

export { Component as Link };
