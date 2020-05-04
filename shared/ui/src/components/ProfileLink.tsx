import React from "react";
import { connect } from "react-redux";
import { openPanel, setProfileUser } from "../../store/context/actions";
import { WebviewPanels } from "@codestream/protocols/webview";
import styled from "styled-components";

interface Props {
	id: string;
	children: React.ReactNode;
	className?: string;
	openPanel?: Function;
	setProfileUser?: Function;
}

const ProfileLink = styled((props: Props) => {
	const onClick = () => {
		props.openPanel && props.openPanel(WebviewPanels.Profile);
		props.setProfileUser && props.setProfileUser(props.id);
	};
	return <span {...{ onClickCapture: onClick, className: props.className }}>{props.children}</span>;
})`
	cursor: pointer;
`;

const mapStateToProps = (state, props: Props) => ({});
const Component = connect(mapStateToProps, { openPanel, setProfileUser })(ProfileLink);

export { Component as ProfileLink };
