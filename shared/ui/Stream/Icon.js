import React from "react";
import createClassString from "classnames";
import octicons from "octicons";

const Icon = React.forwardRef((props, ref) => {
	const octicon = octicons[props.name];
	if (!octicon) throw new Error(`No icon found for '${props.name}'`);

	return (
		<span
			className={createClassString("icon", props.className)}
			onClick={props.onClick}
			dangerouslySetInnerHTML={{ __html: octicon.toSVG() }}
			ref={ref}
		/>
	);
});
Icon.defaultProps = {
	className: "",
	onClick: event => event.preventDefault()
};

export default Icon;
