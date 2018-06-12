import React from "react";
import createClassString from "classnames";
import octicons from "octicons";

const Icon = props => {
	const octicon = octicons[props.name];
	if (!octicon) throw new Error(`No icon found for '${props.name}'`);

	const icon = (
		<span
			className={createClassString("icon", props.className)}
			onClick={props.onClick}
			dangerouslySetInnerHTML={{ __html: octicon.toSVG() }}
		/>
	);

	if (props.label) {
		return (
			<span>
				{props.label} {icon}
			</span>
		);
	}

	return icon;
};

Icon.defaultProps = {
	className: "",
	onClick: event => event.preventDefault()
};

export default Icon;
