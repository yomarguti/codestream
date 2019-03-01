import React from "react";
import Icon from "./Icon";
import createClassString from "classnames";

Button.defaultProps = {
	className: "",
	disabled: false,
	loading: false
};

export default function Button({
	children = undefined,
	className,
	disabled = false,
	loading = false,
	...extras
}) {
	const { dispatch, ...extraProps } = extras; // remove non-html attributes
	return (
		<button
			className={createClassString("native-key-bindings btn inline-block-tight", className, {
				"btn-primary": true
			})}
			disabled={loading || disabled}
			{...extraProps}
		>
			{loading ? <Icon name="sync" className="spin" /> : children}
		</button>
	);
}
