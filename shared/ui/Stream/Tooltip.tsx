import * as React from "react";
import { default as RCTooltip, RCTooltip as RCT } from "rc-tooltip";
import { AnyObject, emptyObject } from "../utils";
import { ModalContext } from "./Modal";

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
	// TODO: deprecate `title` for `content`

	const overlayStyle = props.overlayStyle || emptyObject;
	const content = props.content ? props.content : <span>{props.title}</span>;

	// if there's no title, just return the children rather than
	// creating a blank hover bubble
	if (!props.content && !props.title) return props.children;

	return (
		<ModalContext.Consumer>
			{({ zIndex }) => (
				<RCTooltip
					placement={props.placement}
					align={props.align}
					overlay={content}
					trigger={["hover", "click"]}
					overlayStyle={{ opacity: 1, zIndex, ...overlayStyle }}
					mouseEnterDelay={props.delay || 0}
				>
					{props.children}
				</RCTooltip>
			)}
		</ModalContext.Consumer>
	);
}
