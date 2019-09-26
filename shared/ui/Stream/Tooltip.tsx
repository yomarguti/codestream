import * as React from "react";
import { default as RCTooltip, RCTooltip as RCT } from "rc-tooltip";
import { AnyObject, emptyObject } from "../utils";

interface Props {
	children: any;
	content?: any;
	title?: any;
	placement?: RCT.Placement;
	align?: any;
	delay?: number;
	overlayStyle?: AnyObject;
}

export type Placement = RCT.Placement;

export default function Tooltip(props: Props) {
	// if (!this.props.title) return this.props.children; // TODO: deprecate `title` for `content`

	const content = props.content ? props.content : <span>{props.title}</span>;
	return (
		<RCTooltip
			placement={props.placement}
			align={props.align}
			overlay={content}
			trigger={["hover", "click"]}
			overlayStyle={{ opacity: 1, ...(props.overlayStyle || emptyObject) }}
			mouseEnterDelay={props.delay || 0}
		>
			{props.children}
		</RCTooltip>
	);
}
