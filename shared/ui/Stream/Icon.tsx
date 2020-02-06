import React from "react";
import createClassString from "classnames";
import Icons8 from "./Icons8";
import octicons from "@primer/octicons";
import Tooltip, { Placement } from "./Tooltip";

interface Props {
	name: string;
	className?: string;
	title?: React.ReactNode;
	placement?: Placement;
	align?: any;
	style?: any;
	delay?: number;
	clickable?: boolean;
	muted?: boolean;
	onClick?(event: React.SyntheticEvent): any;
}

const Icon = React.forwardRef<any, Props>((props, ref) => {
	const icon = Icons8[props.name] || octicons[props.name];
	// const icon = octicons[props.name]; why is this commented out?
	if (!icon) throw new Error(`No icon found for '${props.name}'`);

	const iconImage = (
		<span
			className={createClassString("icon", props.className, {
				clickable: props.clickable,
				muted: props.muted
			})}
			onClick={props.onClick}
			style={props.style}
			dangerouslySetInnerHTML={{ __html: icon.toSVG() }}
			ref={ref}
		/>
	);

	if (props.title) {
		return (
			<Tooltip
				content={props.title}
				placement={props.placement}
				align={props.align}
				delay={props.delay}
			>
				<span>{iconImage}</span>
			</Tooltip>
		);
	} else return iconImage;
});

Icon.defaultProps = {
	clickable: false,
	muted: false,
	className: "",
	onClick: event => event.preventDefault()
};

export default Icon;
