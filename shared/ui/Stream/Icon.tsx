import React from "react";
import createClassString from "classnames";
import Icons8 from "./Icons8";
import octicons from "octicons";
import Tooltip from "./Tooltip";

interface Props {
	name: string;
	className?: string;
	title?: string;
	placement?: string;
	delay?: number;
	onClick?(event: React.SyntheticEvent): any;
}

const Icon = React.forwardRef<any, Props>((props, ref) => {
	const icon = Icons8[props.name] || octicons[props.name];
	// const icon = octicons[props.name];
	if (!icon) throw new Error(`No icon found for '${props.name}'`);

	const iconImage = (
		<span
			className={createClassString("icon", props.className)}
			onClick={props.onClick}
			dangerouslySetInnerHTML={{ __html: icon.toSVG() }}
			ref={ref}
		/>
	);

	if (props.title) {
		return (
			<Tooltip title={props.title} placement={props.placement} delay={props.delay}>
				<span>{iconImage}</span>
			</Tooltip>
		);
	} else return iconImage;
});

Icon.defaultProps = {
	className: "",
	onClick: event => event.preventDefault()
};

export default Icon;
