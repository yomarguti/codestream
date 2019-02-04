import React from "react";
import createClassString from "classnames";
import Icons8 from "./Icons8";
import octicons from "octicons";
import Tooltip from "./Tooltip";

const Icon = React.forwardRef((props, ref) => {
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
