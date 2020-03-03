import React from "react";
import styled from "styled-components";
import { default as RCTooltip, RCTooltip as RCT } from "rc-tooltip";
import { AnyObject, emptyObject } from "../../utils";
import Tooltip from "@codestream/webview/Stream/Tooltip";

export interface Props {
	title?: any;
	placement?: RCT.Placement;
	align?: any;
	overlayStyle?: AnyObject;
}

export function TourTip(props: React.PropsWithChildren<Props>) {
	const buttonRef = React.useRef<HTMLElement>(null);
	const [menuIsOpen, toggleMenu] = React.useReducer((open: boolean) => !open, false);

	const maybeToggleMenu = action => {
		if (action !== "noop") toggleMenu(action);
	};

	//if (!props.title) return props.children || null;
	const title = props.title ? <div style={{ fontSize: "larger" }}>{props.title}</div> : null;

	return (
		<Tooltip
			defaultVisible={true}
			placement={props.placement}
			align={props.align}
			transitionName="zoom"
			title={title}
			delay={1.0}
			trigger={[]}
		>
			{props.children}
		</Tooltip>
	);
}
